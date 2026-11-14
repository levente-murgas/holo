// Live call screens: the Call button in the Inbox, ringing (in and out), and the in-call screen.
// Held in the hand: the call screen (partner's video, your preview, buttons). Face down in the
// stand: the screen goes to the hologram of your partner (drawn by main.js via callHologram()).

import { createCall, remoteVideo } from './call.js';
import { formatDuration } from './call-logic.js';
import { watchFaceDown, askOrientationPermission } from './orientation.js';
import { hidePanel } from './ui.js';
import { setBusyCheck } from './pwa.js';
import { S } from './settings.js';

const $ = (s) => document.querySelector(s);

let call = null, v = null, partner = null, watcher = null, tick = 0, ringer = null;

const inCall = () => v && (v.phase === 'connecting' || v.phase === 'active');

// For main.js: what to draw on the stage during a call, or null when there's no call to show.
export function callHologram() {
  if (!inCall() || !v.inStand) return null;
  if (v.remoteReady && !v.remoteInStand && remoteVideo.videoWidth) return { video: remoteVideo };
  return { text: partner ? partner.name + ' is listening ♥' : '♥' };
}

function statusText() {
  const name = partner ? partner.name : '';
  switch (v.phase) {
    case 'outgoing': return 'Calling ' + name + '…';
    case 'incoming': return name + ' is calling';
    case 'connecting': return 'Connecting…';
    case 'active': return 'In call · ' + formatDuration(Date.now() - v.startedAt);
    case 'ended': return v.reason;
    default: return '';
  }
}

function hintText() {
  const name = partner ? partner.name : 'them';
  if (v.phase !== 'active' && v.phase !== 'connecting') return '';
  if (v.remoteInStand) return name + ' is watching you in the stand ♥ Hold the phone so they can see you.';
  return 'Lay the phone face down in the stand to see ' + name + ' as a hologram.';
}

function render() {
  const show = v && v.phase !== 'idle';
  $('#call').hidden = !show;
  if (!show) return;
  hidePanel();
  $('#call').classList.toggle('in-stand', !!(inCall() && v.inStand));
  $('#callName').textContent = partner ? partner.name : '';
  $('#callStatus').textContent = statusText();
  $('#callHint').textContent = hintText();
  $('#callAccept').hidden = v.phase !== 'incoming';
  $('#callMute').hidden = !inCall();
  $('#callMute').textContent = v.muted ? 'Unmute' : 'Mute';
  $('#callMute').classList.toggle('on', !!v.muted);
  $('#callHang').hidden = v.phase === 'ended';
  $('#callHang').textContent = v.phase === 'incoming' ? 'Decline' : 'Hang up';
  $('#callRemoteBox').classList.toggle('waiting', !(v.remoteReady && !v.remoteInStand));
  const self = $('#callSelf');
  if (self.srcObject !== (v.localStream || null)) self.srcObject = v.localStream || null;
  self.hidden = !v.localStream || v.inStand;
}

function onChange(view) {
  const was = v ? v.phase : 'idle';
  v = view;
  if (v.phase === 'incoming' && was !== 'incoming') ring(true);
  if (v.phase !== 'incoming') ring(false);
  // Watch the orientation for the whole call (permission was asked in the dial/answer tap).
  if (v.phase !== 'idle' && v.phase !== 'ended' && !watcher) restartWatcher();
  if ((v.phase === 'idle' || v.phase === 'ended') && watcher) { watcher.stop(); watcher = null; $('#callMotion').hidden = true; }
  clearInterval(tick);
  if (v.phase === 'active') tick = setInterval(render, 1000);
  render();
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
  $('#call').hidden = false;
  const denied = e && e.name === 'NotAllowedError';
  $('#callStatus').textContent = denied
    ? 'Holo is not allowed to use the camera or microphone. Allow them for Holo (iPhone: Settings → Apps → Safari → Camera / Microphone), then try again.'
    : 'Could not start the call: ' + ((e && e.message) || e);
  setTimeout(() => { if (!v || v.phase === 'idle') $('#call').hidden = true; }, 6000);
}

// After the camera prompt: ask for motion access. iPhone only allows that from a fresh tap, so if
// the automatic request is refused, show a button for it (the call works without; stand detection doesn't).
async function askMotion() {
  const r = await askOrientationPermission();
  $('#callMotion').hidden = r === 'granted';
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
  if (key !== engineKey && call && (!v || v.phase === 'idle' || v.phase === 'ended')) { call.destroy(); call = null; v = null; render(); }
  if (ok && !call) { call = createCall({ inbox, me: st.me, partner: other, onChange }); engineKey = key; }
  partner = other;
  $('#callBtn').hidden = !ok;
  if (ok) $('#callBtn').textContent = S.callSelf ? '📞 Call my other device (test)' : '📞 Call ' + other.name;
}
export const refreshCall = () => callInboxState(lastSt, lastInbox);

export function initCallUI() {
  setBusyCheck(() => !!(v && v.phase !== 'idle' && v.phase !== 'ended'));
  document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
  $('#callRemoteBox').prepend(remoteVideo);
  remoteVideo.id = 'callRemote';

  // Camera/microphone first: on iPhone a second permission prompt at the same moment (motion access)
  // makes the camera request fail with NotAllowedError. Motion is asked afterwards.
  $('#callBtn').addEventListener('click', () => {
    if (!call) return;
    unlockAudio();
    call.dial().then(askMotion, showError);
  });
  $('#callAccept').addEventListener('click', () => {
    unlockAudio();
    remoteVideo.play().catch(() => {});     // unlock playback with sound inside this tap
    call.answer().then(askMotion, showError);
  });
  $('#callMotion').addEventListener('click', async () => {
    const r = await askOrientationPermission();
    $('#callMotion').hidden = r === 'granted';
    restartWatcher();
  });
  $('#callHang').addEventListener('click', () => call && call.hangup());
  $('#callMute').addEventListener('click', () => call && call.setMuted(!v.muted));
}
