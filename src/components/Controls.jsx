// The controls over the stage: a glass sheet with the chosen tab, above the dock, which sits down by the home indicator.
// Nothing at the top: that belongs to the hologram preview (new holos show as the count on the Inbox icon).

import { useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Inbox, Phone, Settings } from 'lucide-react';
import { useStore } from '../store.js';
import { setTab, openHoloPage } from '../controllers/stage.js';
import { cn } from './ui.jsx';
import { HoloTab } from './HoloTab.jsx';
import { InboxTab } from './InboxTab.jsx';
import { CallTab } from './CallTab.jsx';
import { SettingsTab } from './SettingsTab.jsx';

const TABS = [
  { id: 'holo', label: 'Hologram', icon: Sparkles, body: HoloTab },
  { id: 'inbox', label: 'Inbox', icon: Inbox, body: InboxTab },
  { id: 'call', label: 'Call', icon: Phone, body: CallTab },
  { id: 'settings', label: 'Settings', icon: Settings, body: SettingsTab },
];

const spring = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 };

function Dock({ tab, unseen }) {
  return (
    <nav className="glass-round flex h-14 w-full items-stretch gap-1 rounded-full p-1.5">
      {TABS.map(({ id, label, icon: Icon }) => {
        const on = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => (on && id === 'holo' ? openHoloPage(null) : setTab(id))}   // Hologram again: back to the gallery
            aria-label={label}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'press relative flex flex-1 items-center justify-center rounded-full',
              on ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {on && (
              <motion.span
                layoutId="dock-pill"
                transition={spring}
                className="absolute inset-0 rounded-full bg-fill-2 shadow-[inset_0_0_0_.5px_var(--glass-stroke)]"
              />
            )}
            <span className="relative">
              <Icon className={cn('size-5', on && 'text-primary')} strokeWidth={on ? 2.1 : 1.8} />
              {id === 'inbox' && unseen > 0 && (
                <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-caption font-semibold text-primary-foreground tabular">
                  {unseen}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// The stage shrinks to fit the room above the controls (main.jsx turns that on and off); work out how much room there is.
function useStageRoom() {
  const observer = useRef(null);
  return useCallback((el) => {
    if (observer.current) { observer.current.disconnect(); window.removeEventListener('resize', observer.current.fit); observer.current = null; }
    if (!el) return;
    const fit = () => {
      const H = window.innerHeight;
      const scale = Math.max(0.28, Math.min(1, (H - el.offsetHeight - 8) / H));
      document.documentElement.style.setProperty('--stage-scale', scale.toFixed(3));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el); ro.fit = fit;
    window.addEventListener('resize', fit);
    observer.current = ro;
    fit();
  }, []);
}

export function Controls({ open }) {
  const room = useStageRoom();
  const tab = useStore((s) => s.tab);
  const unseen = useStore((s) => (s.inbox ? s.inbox.unseen : 0));
  const { body: Body } = TABS.find((t) => t.id === tab);
  const gallery = useStore((s) => s.tab === 'holo' && !s.holoPage);   // the gallery is short: the sheet hugs it and the stage gets the room

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          ref={room}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={spring}
          className="pb-dock fixed inset-x-0 bottom-[calc(-1*var(--viewport-gap,0px))] mx-auto flex max-w-[560px] flex-col gap-2.5 px-3"
        >
          <div className={cn('glass-float flex flex-col overflow-hidden rounded-surface', gallery ? 'max-h-[min(48dvh,540px)]' : 'h-[min(48dvh,540px)]')}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <Body />
              </motion.div>
            </AnimatePresence>
          </div>
          <Dock tab={tab} unseen={unseen} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
