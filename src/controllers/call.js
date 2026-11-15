// Live calls: dialling, answering, the ringtone, and watching for the stand during a call.
// Held in the hand: the call screen (partner's video, your preview, buttons). Face down in the
// stand: the screen goes to the hologram of your partner (drawn by main.jsx via callHologram()).

import { createCall, remoteVideo } from '../../js/call.js';
import { watchFaceDown, askOrientationPermission } from '../../js/orientation.js';
import { setBusyCheck } from '../../js/pwa.js';
import { S } from '../../js/settings.js';
import { set, getState } from '../store.js';

export { remoteVideo };

let call = null, v = null, watcher = null, ringer = null, errorTimer = 0;

const inCall = () => v && (v.phase === 'connecting' || v.phase === 'active');
const partner = () => getState().callWith;

// For main.jsx: what to draw on the stage during a call, or null when there's no call to show.
export function callHologram() {
  if (!inCall() || !v.inStand) return null;
  if (v.remoteReady && !v.remoteInStand && remoteVideo.videoWidth) return { video: remoteVideo };
  const p = partner();
  return { text: p ? p.name + ' is listening' : 'listening' };
}

function onChange(view) {
  const was = v ? v.phase : 'idle';
  v = view;
  if (v.phase === 'incoming' && was !== 'incoming') ring(true);
  if (v.phase !== 'incoming') ring(false);
  // Watch the orientation for the whole call (permission was asked in the dial/answer tap).
  if (v.phase !== 'idle' && v.phase !== 'ended' && !watcher) restartWatcher();
  if ((v.phase === 'idle' || v.phase === 'ended') && watcher) { watcher.stop(); watcher = null; set({ callMotion: false }); }
  set({ call: { ...v } });
}

// A soft two-tone ring while a call comes in (only audible if the page has been tapped before;
// browsers keep sound off until then) plus vibration where supported (Android).
function ring(on) {
  if (!on) {
    if (ringer) { clearInterval(ringer.timer); ringer = null; }
    if (navigator.vibrate) navigator.vibrate(0);
    return;
  }
  if (ringer) return;
  try {
    unlockAudio();
    const ctx = audioCtx;
    const beep = () => {
      [0, 0.25].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = i ? 660 : 880; g.gain.value = 0.08;
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18);
      });
      if (navigator.vibrate) navigator.vibrate([300, 200, 300]);
    };
    beep();
    ringer = { ctx, timer: setInterval(beep, 2000) };
  } catch (_) { /* no audio: the screen still rings */ }
}

function showError(e) {
  const denied = e && e.name === 'NotAllowedError';
  set({
    callError: denied
      ? 'Holo is not allowed to use the camera or microphone. Allow them for Holo (iPhone: Settings → Apps → Safari → Camera / Microphone), then try again.'
      : 'Could not start the call: ' + ((e && e.message) || e),
  });
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => set({ callError: '' }), 6000);
}

// After the camera prompt: ask for motion access. iPhone only allows that from a fresh tap, so if
// the automatic request is refused, show a button for it (the call works without; stand detection doesn't).
export async function askMotion() {
  const r = await askOrientationPermission();
  set({ callMotion: r !== 'granted' });
  restartWatcher();
}
function restartWatcher() {
  if (watcher) { watcher.stop(); watcher = null; }
  if (v && v.phase !== 'idle' && v.phase !== 'ended') watcher = watchFaceDown((down) => call && call.setInStand(down));
}

// Browsers keep sound off until the page has been tapped. Make the ringtone's audio context on the
// first tap anywhere, so an incoming call can ring out loud later while Holo is open.
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (_) { /* no audio */ }
}

let lastSt = null, lastInbox = null, engineKey = '';

// Called by the inbox on every state change: make the call engine once signed in as a member.
// Settings → "Test calls between my own devices" makes the other side yourself (laptop ↔ phone).
export function callInboxState(st, inbox) {
  lastSt = st; lastInbox = inbox;
  const ok = !!(st && st.me && st.partner && inbox);
  const other = ok ? (S.callSelf ? st.me : st.partner) : null;
  const key = ok ? st.me.user_id + '>' + other.user_id : '';
  if (key !== engineKey && call && (!v || v.phase === 'idle' || v.phase === 'ended')) { call.destroy(); call = null; v = null; set({ call: null }); }
  if (ok && !call) { call = createCall({ inbox, me: st.me, partner: other, onChange }); engineKey = key; }
  set({ callWith: other });
}
export const refreshCall = () => callInboxState(lastSt, lastInbox);

// Camera/microphone first: on iPhone a second permission prompt at the same moment (motion access)
// makes the camera request fail with NotAllowedError. Motion is asked afterwards.
export function dial() {
  if (!call) return;
  unlockAudio();
  call.dial().then(askMotion, showError);
}
export function answer() {
  if (!call) return;
  unlockAudio();
  remoteVideo.play().catch(() => {});     // unlock playback with sound inside this tap
  call.answer().then(askMotion, showError);
}
export const hangup = () => call && call.hangup();
export const toggleMute = () => call && v && call.setMuted(!v.muted);

export function initCall() {
  setBusyCheck(() => !!(v && v.phase !== 'idle' && v.phase !== 'ended'));
  document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
  remoteVideo.id = 'callRemote';
}
