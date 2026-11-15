// Asked once per device, right after the first sign-in.

import { Dialog } from 'radix-ui';
import { Bell } from 'lucide-react';
import { useStore } from '../store.js';
import { answerPushDialog } from '../controllers/account.js';
import { Button } from './ui.jsx';

export function PushDialog() {
  const open = useStore((s) => s.pushDialog);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) answerPushDialog(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="glass-float fixed top-1/2 left-1/2 z-40 w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-surface p-5 outline-none">
          <div className="glass-round mb-4 grid size-12 place-items-center rounded-xl text-primary"><Bell className="size-6" /></div>
          <Dialog.Title className="text-metric-s font-medium">Turn on notifications?</Dialog.Title>
          <Dialog.Description className="mt-2 text-item leading-relaxed text-muted-foreground">
            Get a buzz when a new holo, message or call arrives, even when Holo is closed
          </Dialog.Description>
          <div className="mt-5 space-y-2">
            <Button block size="lg" variant="primary" onClick={() => answerPushDialog(true)}>Turn on</Button>
            <Button block variant="ghost" size="sm" onClick={() => answerPushDialog(false)}>Not now</Button>
          </div>
          <p className="mt-3 text-center text-caption text-muted-foreground">You can change this later in Settings</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
