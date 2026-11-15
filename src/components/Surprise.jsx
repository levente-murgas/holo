// Surprise mode: covers the screen until the phone is face down in the stand.

import { AnimatePresence, motion } from 'motion/react';
import { Heart } from 'lucide-react';
import { useStore } from '../store.js';
import { revealSurprise, cancelSurprise } from '../controllers/surprise.js';
import { Button } from './ui.jsx';

export function Surprise() {
  const sp = useStore((s) => s.surprise);
  return (
    <AnimatePresence>
      {sp && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-20 flex items-center justify-center bg-black p-6 text-center"
        >
          <div className="relative w-full max-w-[340px]">
            <Heart className="mx-auto size-16 fill-current text-heart" />
            <h2 className="mt-6 text-metric-m font-medium tracking-[-0.02em]">A surprise from {sp.from}</h2>
            <p className="mt-2.5 text-item leading-relaxed text-muted-foreground">{sp.how}</p>
            <div className="mt-7 space-y-2">
              <Button block variant="tonal" onClick={revealSurprise}>Show it now</Button>
              <Button block variant="ghost" size="sm" onClick={cancelSurprise}>Later</Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
