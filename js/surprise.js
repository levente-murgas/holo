// Surprise mode: a received message stays hidden behind an instruction screen until the phone is
// lying face down in the holo stand; then it is revealed (video starts from the beginning).

import { watchFaceDown, askOrientationPermission } from './orientation.js';

export { askOrientationPermission };

const $ = (s) => document.querySelector(s);
const NO_SENSOR_MS = 1500;    // no orientation reading by then: probably a laptop, say so

const gate = { active: false, onReveal: null, onCancel: null, watch: null, timer: 0 };

export const surpriseActive = () => gate.active;

function reveal() {
  const cb = gate.onReveal;
  stop();
  if (cb) cb();
}

function stop() {
  gate.active = false; gate.onReveal = null; gate.onCancel = null;
  clearTimeout(gate.timer);
  if (gate.watch) { gate.watch.stop(); gate.watch = null; }
  $('#surprise').hidden = true;
}

// from: sender's name. permission: result of askOrientationPermission().
// onReveal(): show/play the message. onCancel(): "Later" was tapped, put the message away unseen.
export async function startSurprise({ from, permission, onReveal, onCancel }) {
  stop();
  Object.assign(gate, { active: true, onReveal, onCancel });
  $('#surpriseFrom').textContent = 'A surprise from ' + from + ' ♥';
  $('#surpriseHow').textContent = 'Put the phone face down in the holo stand to open it.';
  $('#surprise').hidden = false;

  if ((await permission) !== 'granted') {
    $('#surpriseHow').textContent = 'Motion access was not allowed, so Holo can\'t tell when the phone is in the stand. Tap “Show it now” once it\'s in place.';
    return;
  }
  if (!gate.active) return;
  gate.watch = watchFaceDown((down) => { if (down) reveal(); });
  gate.timer = setTimeout(() => {
    if (gate.active && gate.watch && !gate.watch.sawSensor()) $('#surpriseHow').textContent = 'This device has no motion sensor. Tap “Show it now” when you\'re ready.';
  }, NO_SENSOR_MS);
}

export function initSurprise() {
  $('#surpriseNow').addEventListener('click', reveal);
  $('#surpriseCancel').addEventListener('click', () => { const cb = gate.onCancel; stop(); if (cb) cb(); });
}
