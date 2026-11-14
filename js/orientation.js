// Is the phone lying face down (in the holo stand)? Shared by Surprise mode and live calls.

import { isFaceDown } from './surprise-logic.js';

// iPhone asks for motion & orientation access, and only from a tap: call this first thing in the tap.
export function askOrientationPermission() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') return D.requestPermission().catch(() => 'denied');
  return Promise.resolve('granted');
}

// Calls onChange(true) once the phone has stayed face down for holdMs, and onChange(false) as soon
// as it is picked up again. Returns { stop(), sawSensor() }.
export function watchFaceDown(onChange, { holdMs = 700 } = {}) {
  let down = false, reported = false, hold = 0, saw = false;
  function onEvent(e) {
    if (e.beta == null) return;
    saw = true;
    const now = isFaceDown(e.beta, down);
    // A timer rather than the next event: a phone lying still may stop sending orientation events.
    if (now && !down) hold = setTimeout(() => { if (down && !reported) { reported = true; onChange(true); } }, holdMs);
    if (!now) {
      clearTimeout(hold);
      if (reported) { reported = false; onChange(false); }
    }
    down = now;
  }
  window.addEventListener('deviceorientation', onEvent);
  return {
    stop() { clearTimeout(hold); window.removeEventListener('deviceorientation', onEvent); },
    sawSensor: () => saw,
  };
}
