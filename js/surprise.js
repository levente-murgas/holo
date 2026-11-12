// Surprise mode: a received message stays hidden behind an instruction screen until the phone is
// lying face down in the holo stand; then it is revealed (video starts from the beginning).

import { isFaceDown } from './surprise-logic.js';

const $ = (s) => document.querySelector(s);
const HOLD_MS = 700;          // must stay face down this long (so flipping it over doesn't count)
const NO_SENSOR_MS = 1500;    // no orientation reading by then: probably a laptop, say so

const gate = { active: false, onReveal: null, onCancel: null, down: false, hold: 0, timer: 0, sawSensor: false };

export const surpriseActive = () => gate.active;

// iPhone asks for motion & orientation access, and only from a tap: call this first thing in the tap.
export function askOrientationPermission() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') return D.requestPermission().catch(() => 'denied');
  return Promise.resolve('granted');
}

function onOrientation(e) {
  if (!gate.active || e.beta == null) return;
  gate.sawSensor = true;
  const down = isFaceDown(e.beta, gate.down);
  // A timer rather than the next event: a phone lying still may stop sending orientation events.
  if (down && !gate.down) gate.hold = setTimeout(() => { if (gate.active && gate.down) reveal(); }, HOLD_MS);
  if (!down) clearTimeout(gate.hold);
  gate.down = down;
}

function reveal() {
  const cb = gate.onReveal;
  stop();
  if (cb) cb();
}

function stop() {
  gate.active = false; gate.onReveal = null; gate.onCancel = null; gate.down = false;
  clearTimeout(gate.timer); clearTimeout(gate.hold);
  window.removeEventListener('deviceorientation', onOrientation);
  $('#surprise').hidden = true;
}

// from: sender's name. permission: result of askOrientationPermission().
// onReveal(): show/play the message. onCancel(): "Later" was tapped, put the message away unseen.
export async function startSurprise({ from, permission, onReveal, onCancel }) {
  stop();
  Object.assign(gate, { active: true, onReveal, onCancel, sawSensor: false });
  $('#surpriseFrom').textContent = 'A surprise from ' + from + ' ♥';
  $('#surpriseHow').textContent = 'Put the phone face down in the holo stand to open it.';
  $('#surprise').hidden = false;

  if ((await permission) !== 'granted') {
    $('#surpriseHow').textContent = 'Motion access was not allowed, so Holo can\'t tell when the phone is in the stand. Tap “Show it now” once it\'s in place.';
    return;
  }
  window.addEventListener('deviceorientation', onOrientation);
  gate.timer = setTimeout(() => {
    if (gate.active && !gate.sawSensor) $('#surpriseHow').textContent = 'This device has no motion sensor. Tap “Show it now” when you\'re ready.';
  }, NO_SENSOR_MS);
}

export function initSurprise() {
  $('#surpriseNow').addEventListener('click', reveal);
  $('#surpriseCancel').addEventListener('click', () => { const cb = gate.onCancel; stop(); if (cb) cb(); });
}
