// Inbox tab: the holos and messages you've sent each other, newest first. Tap one to put it on the stage.

import { Film, Heart, ImagePlay, Sticker, CalendarHeart, Inbox as InboxIcon, ArrowUpRight } from 'lucide-react';
import { timeAgo } from '../../js/inbox-logic.js';
import { useStore } from '../store.js';
import { play, nameOf } from '../controllers/inbox.js';
import { Section, Note, TabBody, IconTile, cn } from './ui.jsx';
import { SignIn } from './SignIn.jsx';

function Message({ m, me }) {
  const mine = m.sender === me && m.recipient !== me;
  const unseen = !mine && !m.seen_at;
  const video = !!m.clip_path;
  const gif = m.src === 'gif';
  const stk = m.src === 'sticker';
  const cd = m.src === 'countdown';
  return (
    <li>
      <button
        type="button"
        onClick={() => play(m)}
        className={cn('press flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left hover:bg-fill-1', unseen && 'bg-fill-1')}
      >
        <IconTile className={cn(unseen && 'text-primary', !video && 'text-heart')}>
          {cd ? <CalendarHeart /> : stk ? <Sticker /> : gif ? <ImagePlay /> : video ? <Film /> : <Heart />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-item">
            {mine && <ArrowUpRight className="size-icon-sm text-muted-foreground" />}
            <span className={cn(unseen && 'font-medium')}>{mine ? 'To ' + nameOf(m.recipient) : nameOf(m.sender)}</span>
          </div>
          <div className="mt-0.5 truncate text-meta text-muted-foreground">
            {cd ? 'Countdown' : stk ? 'Sticker' : gif ? 'GIF' : video ? 'Holo video' : 'Message'}{m.text && !unseen && !cd ? ' · “' + m.text + '”' : ''}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="tabular text-caption text-muted-foreground">{timeAgo(m.created_at)}</span>
          {unseen && <span className="dot bg-primary" />}
        </div>
      </button>
    </li>
  );
}

export function InboxTab() {
  const st = useStore((s) => s.inbox);
  const configured = useStore((s) => s.configured);
  const status = useStore((s) => s.inboxStatus);
  const signedIn = !!(st && st.user);

  if (!configured || !st) return <TabBody><Note>{status || 'Connecting…'}</Note></TabBody>;

  if (!signedIn || st.notMember) {
    return (
      <TabBody>
        <Section title="Sign in">
          <p className="px-1 text-body text-muted-foreground">Use the email Holo was set up with. You'll get a code; you only do this once on each phone.</p>
          <SignIn />
        </Section>
        <Note>{status}</Note>
      </TabBody>
    );
  }

  return (
    <TabBody>
      <Section title={st.unseen ? st.unseen + ' new' : 'Inbox'} aside={<span className="text-meta text-muted-foreground">{st.me ? st.me.name : st.user.email}</span>}>
        {st.messages.length ? (
          <ul className="-mx-1 space-y-1">
            {st.messages.map((m) => <Message key={m.id} m={m} me={st.user.id} />)}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <IconTile className="size-11 [&_svg]:size-5"><InboxIcon /></IconTile>
            <div className="text-item">No holos yet</div>
            <div className="max-w-[260px] text-meta text-muted-foreground">Record a clip on the Hologram tab and send it — it'll float in their stand</div>
          </div>
        )}
      </Section>
      <Note>{status}</Note>
    </TabBody>
  );
}
