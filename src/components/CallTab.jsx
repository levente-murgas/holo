// Call tab: ring your partner. During the call, lay the phone in the stand to see them as a hologram.

import { Phone, Smartphone } from 'lucide-react';
import { useStore, set } from '../store.js';
import { dial } from '../controllers/call.js';
import { Button, Note, TabBody } from './ui.jsx';

export function CallTab() {
  const who = useStore((s) => s.callWith);
  const self = useStore((s) => s.s.callSelf);
  const st = useStore((s) => s.inbox);

  if (!who) {
    return (
      <TabBody>
        <Note>{st && st.user ? 'Calls need both of you on the members list' : 'Sign in under Inbox to call'}</Note>
        {!(st && st.user) && <Button variant="tonal" block onClick={() => set({ tab: 'inbox' })}>Go to Inbox</Button>}
      </TabBody>
    );
  }

  return (
    <TabBody footer={(
      <Button block size="lg" variant="primary" onClick={dial}>
        {self ? <Smartphone /> : <Phone />} {self ? 'Call my other device' : 'Call ' + who.name}
      </Button>
    )}>
      <div className="flex flex-col items-center py-4 text-center">
        <div className="relative grid size-24 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#f3dca8,#b98d3e_55%,#5a4319)] text-[40px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_0_0_1px_rgb(255_255_255/.12)]">
          {(self ? 'Me' : who.name).slice(0, 1).toUpperCase()}
        </div>
        <div className="mt-4 text-metric-s font-medium">{self ? 'Your other devices' : who.name}</div>
        <p className="mt-1.5 max-w-[300px] text-body text-muted-foreground">
          {self
            ? 'Testing alone: this rings your own devices signed in as you (Settings → Calls)'
            : 'Talk with the phone in your hand. Lay it face down in the stand and ' + who.name + ' appears as a hologram.'}
        </p>
      </div>
    </TabBody>
  );
}
