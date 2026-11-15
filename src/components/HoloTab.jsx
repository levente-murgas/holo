// Hologram tab: a small gallery of what can go on the stage (a message, a video, a GIF, a sticker, a countdown).
// Picking one opens its page with what that kind needs: the words, the clip, the GIPHY search, the date, then how
// it looks and the stand.
// There's no "start" button: tapping the stage above the controls shows the hologram full screen.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Collapsible } from 'radix-ui';
import {
  Film, MessageCircleHeart, ImagePlay, Upload, Send, RotateCw, FlipHorizontal2, Volume2, VolumeX, Play, Pause,
  ChevronDown, ChevronLeft, Lightbulb, Search, Sticker, CalendarHeart, Pipette,
} from 'lucide-react';
import { keyFor } from '../../js/settings.js';
import { isGiphyConfigured, searchGifs } from '../../js/giphy.js';
import { FONTS, COLORS, STYLE_KEYS, styleOf, daysUntil, countdownLines } from '../../js/textstyle.js';
import { useStore, setSettings } from '../store.js';
import { toggle, rotate, togglePlay, pickFile, pickMedia, openHoloPage } from '../controllers/stage.js';
import { send, sendInfo } from '../controllers/inbox.js';
import { Button, Chip, Section, Segmented, SliderRow, Input, Note, TabBody, cn } from './ui.jsx';

const ease = [0.23, 1, 0.32, 1];

// ---------- shared pieces ----------

const fmt = (k, v) => (k === 'oval' && v >= 1.58 ? 'off' : (+v).toFixed(2));

function Slider({ k, label, min, max, step }) {
  const s = useStore((st) => st.s);
  const key = keyFor(k, s);
  return (
    <SliderRow
      label={label} min={min} max={max} step={step}
      value={s[key]} display={fmt(k, s[key])}
      onChange={(v) => setSettings({ [keyFor(k)]: v })}
    />
  );
}

function Look({ cut }) {
  const s = useStore((st) => st.s);
  return (
    <Section title="Look">
      <div className="inset">
        {cut && (
          <>
            <Slider k="thr" label="Background cut" min={0} max={0.6} step={0.01} />
            <Slider k="soft" label="Edge softness" min={0.01} max={0.4} step={0.01} />
            {s.mode === 'video' && s.src === 'rec' && <Slider k="oval" label="Face oval" min={0.4} max={1.6} step={0.01} />}
          </>
        )}
        <Slider k="gain" label="Brightness" min={0.6} max={3} step={0.05} />
        <Slider k="size" label="Size" min={0.3} max={1.6} step={0.01} />
        <Slider k="pos" label="Position" min={-1} max={1} step={0.01} />
      </div>
    </Section>
  );
}

function Stand({ children }) {
  const s = useStore((st) => st.s);
  return (
    <Section title="Stand">
      <div className="flex flex-wrap gap-2">
        <Chip onClick={rotate}><RotateCw /> Rotate {s.rot}°</Chip>
        <Chip on={s.mirror} onClick={() => toggle('mirror')}><FlipHorizontal2 /> Mirror</Chip>
        {children}
      </div>
    </Section>
  );
}

/** The page's one action, kept at the bottom: send what's on the stage. Nothing when there's no one to send to. */
function useSendFooter() {
  const s = useStore((st) => st.s);
  const st = useStore((x) => x.inbox);
  const v = useStore((x) => x.video);
  const gif = useStore((x) => x.gif);
  const stk = useStore((x) => x.sticker);
  const sending = useStore((x) => x.sending);
  const status = useStore((x) => x.inboxStatus);
  if (!st || !st.me || !st.partner) return null;
  const { label, can } = sendInfo(s, st, v, gif, stk);
  return (
    <div className="space-y-2">
      <Note>{status}</Note>
      <Button block size="lg" variant="primary" disabled={!can || sending} onClick={send}>
        <Send /> {sending ? 'Sending…' : label}
      </Button>
    </div>
  );
}

function PageHeader({ title }) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-2 py-2">
      <Button variant="ghost" size="icon" aria-label="Back to the gallery" onClick={() => openHoloPage(null)}><ChevronLeft /></Button>
      <h2 className="text-title font-medium">{title}</h2>
    </div>
  );
}

// ---------- the gallery ----------

// One trending GIF and one sticker for their cards, fetched once per visit.
const trending = {};
function useTrendingThumb(kind) {
  const [thumb, setThumb] = useState(trending[kind] || null);
  useEffect(() => {
    if (thumb || !isGiphyConfigured()) return;
    let off = false;
    searchGifs('', 0, 1, kind).then((r) => { if (r.items[0] && !off) setThumb((trending[kind] = r.items[0].thumb)); }).catch(() => {});
    return () => { off = true; };
  }, [thumb, kind]);
  return thumb;
}

// A GIF or sticker always shows whole in its window: pinned to the window's box (a grid row sized by its content
// would let a tall image set its own height and get cropped), then scaled down to fit, with black around it.
const FIT = 'absolute inset-0 size-full object-contain';

const Peek = ({ children }) => (
  <span className="grid size-10 place-items-center rounded-full bg-fill-2 text-foreground [&_svg]:size-icon">{children}</span>
);

/** A card in the gallery: a small black window like the stage, with a peek of that kind, and its name. */
function Card({ id, label, icon: Icon, tilt, className, children }) {
  const live = useStore((st) => st.s.mode === id);
  return (
    <button
      type="button"
      onClick={() => openHoloPage(id)}
      aria-label={label}
      style={{ rotate: tilt }}
      className={cn(
        'press flex flex-col gap-2 rounded-surface bg-fill-1 p-2 text-left hover:bg-fill-2',
        'shadow-[inset_0_0_0_.5px_var(--glass-stroke)]',
        className,
      )}
    >
      <div className="relative grid h-20 w-full place-items-center overflow-hidden rounded-[calc(var(--radius-surface)-8px)] bg-black">
        {children}
      </div>
      <div className="flex items-center gap-1.5 px-1 pb-0.5 text-item font-medium">
        <Icon className="size-icon-sm text-muted-foreground" />
        {label}
        {live && <span className="dot ml-auto bg-primary" title="On the stage" />}
      </div>
    </button>
  );
}

// The words' face and colour as CSS, so a card or chip previews what the stage will show.
const wordsCss = (s, kind) => {
  const { font, color } = styleOf(s, kind);
  return { fontFamily: FONTS[font].family, fontWeight: FONTS[font].weight, color };
};

function Gallery() {
  const s = useStore((st) => st.s);
  const msg = s.msg;
  const days = countdownLines(daysUntil(s.visit));
  const v = useStore((st) => st.video);
  const gif = useStore((st) => st.gif);
  const stk = useStore((st) => st.sticker);
  const gifTrending = useTrendingThumb('gifs');
  const stkTrending = useTrendingThumb('stickers');
  const gifThumb = (gif.item && gif.item.thumb) || gifTrending;
  const stkThumb = (stk.item && stk.item.thumb) || stkTrending;

  return (
    <TabBody>
      <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-4 px-1 py-2">
        <Card id="message" label="Message" icon={MessageCircleHeart} tilt="-1.5deg" className="w-[46%]">
          <span className="line-clamp-2 px-3 text-center text-title" style={wordsCss(s, 'message')}>{msg || 'Your words'}</span>
        </Card>
        <Card id="countdown" label="Countdown" icon={CalendarHeart} tilt="2deg" className="w-[40%]">
          {s.visit ? (
            <span className="flex flex-col items-center text-center leading-none" style={wordsCss(s, 'countdown')}>
              <span className="tabular text-metric-m">{days.big}</span>
              <span className="mt-1.5 text-caption">{days.small}</span>
            </span>
          ) : <Peek><CalendarHeart /></Peek>}
        </Card>
        <Card id="video" label="Video" icon={Film} tilt="1.5deg" className="w-[30%]">
          <Peek>{v.file ? <Play /> : <Upload />}</Peek>
        </Card>
        <Card id="gif" label="GIF" icon={ImagePlay} tilt="-1deg" className="w-[30%]">
          {gifThumb ? <img src={gifThumb} alt="" className={FIT} /> : <Peek><Search /></Peek>}
        </Card>
        {/* a sticker's background is already transparent, so on black it looks the way it will in the stand */}
        <Card id="sticker" label="Sticker" icon={Sticker} tilt="2deg" className="w-[30%]">
          {stkThumb ? <img src={stkThumb} alt="" className={cn(FIT, 'p-2')} /> : <Peek><Sticker /></Peek>}
        </Card>
      </div>
    </TabBody>
  );
}

// ---------- the pages ----------

// The words' face (each chip in its own face) and colour (swatches, then any colour), like a story's text tools.
function TextStyle({ kind }) {
  const s = useStore((st) => st.s);
  const { font, color } = styleOf(s, kind);
  const keys = STYLE_KEYS[kind];
  const custom = !COLORS.includes(color);
  return (
    <Section title="Text">
      <div className="scroll-x -mx-4 flex gap-2 px-4">
        {Object.entries(FONTS).map(([k, f]) => (
          <Chip key={k} on={font === k} onClick={() => setSettings({ [keys.font]: k })} className="shrink-0" style={{ fontFamily: f.family, fontWeight: f.weight }}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="scroll-x -mx-4 flex items-center gap-2.5 px-4 py-1">
        {COLORS.map((c) => (
          <button
            key={c} type="button" aria-label={'Colour ' + c} aria-pressed={color === c}
            onClick={() => setSettings({ [keys.color]: c })}
            className={cn('press size-7 shrink-0 rounded-full', color === c && 'ring-2 ring-foreground ring-offset-2 ring-offset-black')}
            style={{ background: c }}
          />
        ))}
        {/* any colour: the system picker, behind a swatch that shows the colour picked there */}
        <label
          className={cn('press relative grid size-7 shrink-0 place-items-center rounded-full bg-fill-2 text-foreground [&_svg]:size-icon-sm', custom && 'ring-2 ring-foreground ring-offset-2 ring-offset-black')}
          style={custom ? { background: color } : undefined}
        >
          {!custom && <Pipette />}
          <input type="color" aria-label="Any colour" value={color} onChange={(e) => setSettings({ [keys.color]: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
      </div>
    </Section>
  );
}

function MessagePage() {
  const msg = useStore((st) => st.s.msg);
  const footer = useSendFooter();
  return (
    <>
      <PageHeader title="Message" />
      <TabBody footer={footer}>
        <Input value={msg} maxLength={60} placeholder="Your message" onChange={(e) => setSettings({ msg: e.target.value })} />
        <TextStyle kind="message" />
        <Look />
        <Stand />
      </TabBody>
    </>
  );
}

function Tips() {
  return (
    <Collapsible.Root className="inset">
      <Collapsible.Trigger className="group flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <Lightbulb className="size-icon text-muted-foreground" />
        <span className="flex-1 text-item">Tips for a good hologram</span>
        <ChevronDown className="size-icon text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </Collapsible.Trigger>
      <Collapsible.Content>
        <ul className="space-y-2.5 px-3.5 py-3 text-body leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
          <li><b>Install it.</b> In Safari: Share → Add to Home Screen, then open Holo from its icon. It runs full screen and keeps the screen on. The app signs in separately from Safari, with the code from the sign-in email.</li>
          <li><b>Line it up first.</b> With a message on the stage, rotate and mirror until the words read normally and the right way up in the reflection. Holo remembers it.</li>
          <li><b>Filming.</b> Front camera, a dark wall or room behind you, a lamp or a phone torch lighting your face from the front. Wear something light: dark clothes disappear.</li>
          <li><b>Background cut.</b> Raise it until the background is fully black; lower it if your face starts losing pieces. Shrink the face oval to crop away anything that's left.</li>
          <li>Black is invisible in the reflection, so anything that isn't pure black will glow.</li>
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function VideoPage() {
  const s = useStore((st) => st.s);
  const v = useStore((st) => st.video);
  const playing = useStore((st) => st.playing);
  const file = useRef(null);
  const footer = useSendFooter();

  return (
    <>
      <PageHeader title="Video" />
      <TabBody footer={footer}>
        <Section>
          <Button block variant="tonal" onClick={() => file.current && file.current.click()}>
            <Upload /> {v.file ? 'Choose another video' : 'Record or choose a video'}
          </Button>
          <input
            ref={file} type="file" accept="video/*" hidden
            onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) pickFile(f); e.target.value = ''; }}
          />
          <Note>{v.status}</Note>
          <Segmented
            label="Video type" value={s.src} onChange={(src) => setSettings({ src })}
            options={[
              { value: 'rec', label: 'My recording' },
              { value: 'holo1', label: 'Holo · 1 view' },
              { value: 'holo4', label: 'Holo · 4' },
            ]}
          />
          {s.src === 'holo4' && (
            <Segmented
              label="Which view to show" value={s.view} onChange={(view) => setSettings({ view })}
              options={['bottom', 'top', 'left', 'right'].map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))}
            />
          )}
        </Section>
        <Look cut />
        <Stand>
          <Chip on={s.sound} onClick={() => toggle('sound')}>{s.sound ? <Volume2 /> : <VolumeX />} Sound</Chip>
          {v.ready && <Chip onClick={togglePlay}>{playing ? <Pause /> : <Play />} {playing ? 'Pause' : 'Play'}</Chip>}
        </Stand>
        <Tips />
      </TabBody>
    </>
  );
}

const KINDS = {
  gif: { api: 'gifs', title: 'GIF', many: 'GIFs', fit: 'p-0.5' },
  sticker: { api: 'stickers', title: 'Sticker', many: 'stickers', fit: 'p-1' },
};

// The search box and a grid of results; trending while the box is empty.
function GiphyPicker({ kind, onPick, chosen }) {
  const k = KINDS[kind];
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let off = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await searchGifs(q, 0, 24, k.api);
        if (!off) { setItems(r.items); setNext(r.next); setError(''); }
      } catch (e) { if (!off) setError(e.message || String(e)); }
      if (!off) setBusy(false);
    }, q ? 350 : 0);
    return () => { off = true; clearTimeout(t); };
  }, [q, k.api]);

  async function more() {
    setBusy(true);
    try {
      const r = await searchGifs(q, next, 24, k.api);
      setItems((x) => [...x, ...r.items.filter((it) => !x.some((y) => y.id === it.id))]);
      setNext(r.next);
    } catch (e) { setError(e.message || String(e)); }
    setBusy(false);
  }

  return (
    <Section>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-icon -translate-y-1/2 text-muted-foreground" />
        <Input type="search" enterKeyHint="search" value={q} placeholder={'Search GIPHY ' + k.many} className="pl-10" onChange={(e) => setQ(e.target.value)} />
      </div>
      <Note>{error}</Note>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((it) => (
          <button
            key={it.id} type="button" onClick={() => onPick(it)} aria-label={it.title}
            className={cn('press relative aspect-square overflow-hidden rounded-chip bg-black', chosen === it.id && 'ring-2 ring-primary')}
          >
            <img src={it.thumb} alt="" loading="lazy" className={cn(FIT, k.fit)} />
          </button>
        ))}
      </div>
      {!busy && !error && !items.length && <Note className="py-4 text-center">{'No ' + k.many + ' for that'}</Note>}
      {next !== null && items.length > 0 && (
        <Button block variant="ghost" disabled={busy} onClick={more}>{busy ? 'Loading…' : 'More'}</Button>
      )}
      <p className="px-1 text-center text-caption text-muted-foreground">Powered by GIPHY</p>
    </Section>
  );
}

function GiphyPage({ kind }) {
  const k = KINDS[kind];
  const gif = useStore((st) => st[kind]);
  const [picking, setBrowsing] = useState(!gif.item);
  const footer = useSendFooter();
  const configured = isGiphyConfigured();
  const item = gif.item;
  const browsing = picking && configured;   // without a key there's nothing to browse: show what's on the stage

  return (
    <>
      <PageHeader title={k.title} />
      <TabBody footer={browsing ? null : footer}>
        {!configured && !item && (
          <Note>{k.title}s need a GIPHY API key: add it as GIPHY_KEY in js/config.js</Note>
        )}
        {configured && browsing && (
          <GiphyPicker kind={kind} chosen={item && item.id} onPick={(it) => { pickMedia(kind, it); setBrowsing(false); }} />
        )}
        {!browsing && item && (
          <>
            <div className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-control bg-black">
                {item.thumb && <img src={item.thumb} alt="" className={cn(FIT, k.fit)} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-item">{item.title}</div>
                <div className="text-meta text-muted-foreground">{gif.loading ? 'Loading…' : gif.status || (gif.ready ? 'On the stage' : '')}</div>
              </div>
              {configured && <Chip onClick={() => setBrowsing(true)}><Search /> Change</Chip>}
            </div>
            <Look cut />
            <Stand />
          </>
        )}
      </TabBody>
    </>
  );
}

// Today as YYYY-MM-DD in local time (the date input's min).
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

function CountdownPage() {
  const visit = useStore((st) => st.s.visit);
  const footer = useSendFooter();
  const n = daysUntil(visit);
  return (
    <>
      <PageHeader title="Countdown" />
      <TabBody footer={footer}>
        <Section title="Next visit">
          <Input
            type="date" value={visit} min={today()} aria-label="Date of the next visit"
            onChange={(e) => setSettings({ visit: e.target.value })}
            className="[color-scheme:dark]"
          />
          <Note>{n === null ? 'The stage counts the days down to it' : n < 0 ? 'That day has passed: pick the next one' : ''}</Note>
        </Section>
        <TextStyle kind="countdown" />
        <Look />
        <Stand />
      </TabBody>
    </>
  );
}

const PAGES = {
  message: MessagePage, video: VideoPage, countdown: CountdownPage,
  gif: () => <GiphyPage key="gif" kind="gif" />,
  sticker: () => <GiphyPage key="sticker" kind="sticker" />,
};

export function HoloTab() {
  const page = useStore((st) => st.holoPage);
  const Page = page ? PAGES[page] : Gallery;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={page || 'gallery'}
        initial={{ opacity: 0, x: page ? 16 : -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: page ? 16 : -16 }}
        transition={{ duration: 0.18, ease }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Page />
      </motion.div>
    </AnimatePresence>
  );
}
