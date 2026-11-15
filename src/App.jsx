// The screens over the stage. Order is depth: the controls, then setup, a waiting surprise, a call, and dialogs on top.

import { AnimatePresence, motion } from 'motion/react';
import { useStore } from './store.js';
import { toggleControls } from './controllers/stage.js';
import { Controls } from './components/Controls.jsx';
import { Setup } from './components/Setup.jsx';
import { Surprise } from './components/Surprise.jsx';
import { CallScreen } from './components/CallScreen.jsx';
import { PushDialog } from './components/PushDialog.jsx';

export function App() {
  const controls = useStore((s) => s.controls);
  const hint = useStore((s) => s.hint);

  return (
    <>
      {/* tapping the stage shows or hides the controls */}
      <div className="fixed inset-0" onClick={toggleControls} aria-hidden="true" />

      <Controls open={controls} />

      <AnimatePresence>
        {hint && !controls && (
          <motion.div
            key="hint"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-round pointer-events-none fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full px-3.5 py-2 text-meta text-muted-foreground"
          >
            Tap anywhere for controls
          </motion.div>
        )}
      </AnimatePresence>

      <Setup />
      <Surprise />
      <CallScreen />
      <PushDialog />
    </>
  );
}
