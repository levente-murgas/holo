// Surprise mode: a received message stays hidden behind an instruction screen until the phone is
// lying face down in the holo stand; then it is revealed (video starts from the beginning).

import { watchFaceDown, askOrientationPermission } from '../../js/orientation.js';
import { set, getState } from '../store.js';

export { askOrientationPermission };

const NO_SENSOR_MS = 1500;    // no orientation reading by then: probably a laptop, say so

const gate = { onReveal: null, onCancel: null, watch: null, timer: 0 };

export const surpriseActive = () => !!getState().surprise;

const say = (how) => set((st) => (st.surprise ? { surprise: { ...st.surprise, how } } : {}));

function stop() {
  gate.onReveal = null; gate.onCancel = null;
  clearTimeout(gate.timer);
  if (gate.watch) { gate.watch.stop(); gate.watch = null; }
  set({ surprise: null });
}

export function revealSurprise() {
  const cb = gate.onReveal;
  stop();
  if (cb) cb();
}

export function cancelSurprise() {
  const cb = gate.onCancel;
  stop();
  if (cb) cb();
}

// from: sender's name. permission: result of askOrientationPermission().
// onReveal(): show/play the message. onCancel(): "Later" was tapped, put the message away unseen.
export async function startSurprise({ from, permission, onReveal, onCancel }) {
  stop();
  Object.assign(gate, { onReveal, onCancel });
  set({ surprise: { from, how: 'Put the phone face down in the holo stand to open it' } });

  if ((await permission) !== 'granted') {
    say('Motion access was not allowed, so Holo can\'t tell when the phone is in the stand. Tap “Show it now” once it\'s in place.');
    return;
  }
  if (!surpriseActive()) return;
  gate.watch = watchFaceDown((down) => { if (down) revealSurprise(); });
  gate.timer = setTimeout(() => {
    if (surpriseActive() && gate.watch && !gate.watch.sawSensor()) say('This device has no motion sensor. Tap “Show it now” when you\'re ready.');
  }, NO_SENSOR_MS);
}
