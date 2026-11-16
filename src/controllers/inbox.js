// Inbox: sign-in, sending what's on the stage, and playing a received message (with Surprise mode).

import { S } from '../../js/settings.js';
import { video, videoState, gifVideo, gifState, sticker, stickerState, doodle } from '../../js/sources.js';
import { isSurprise } from '../../js/surprise-logic.js';
import { styleOf, stylePatch, daysUntil } from '../../js/textstyle.js';
import { cleanStrokes, hasInk, toFileData } from '../../js/doodle.js';
import { isConfigured, createInbox } from '../../js/inbox.js';
import { isInstalled } from '../../js/pwa.js';
import { set, getState, setSettings } from '../store.js';
import { askOrientationPermission, startSurprise } from './surprise.js';
import { loadClip, loadReceivedMedia, hideControls, showControls } from './stage.js';
import { pushInboxState } from './account.js';
import { setupInboxState } from './setup.js';
import { callInboxState } from './call.js';

let inbox = null;
export const getInbox = () => inbox;

const setStatus = (inboxStatus) => set({ inboxStatus: inboxStatus || '' });

export function nameOf(id) {
  const st = getState().inbox;
  const m = st && st.members.find((x) => x.user_id === id);
  return m ? m.name : '?';
}

function onState(st) {
  set({ inbox: st, ...(st.error ? { inboxStatus: st.error } : {}) });
  pushInboxState(st);
  setupInboxState(st);
  callInboxState(st, inbox);
}

export async function initInbox() {
  if (!isConfigured()) {
    set({ configured: false, push: 'none' });
    setStatus('Sending is not set up yet: fill in js/config.js (see SETUP.md).');
    return;
  }
  try {
    inbox = await createInbox(onState);
  } catch (e) { setStatus('Could not load Supabase: ' + (e.message || e)); set({ push: 'none' }); return; }
  // The first state can arrive before createInbox() returns; go over it again now the inbox exists.
  if (getState().inbox) onState(getState().inbox);
}

// ---- signing in (Inbox tab and setup share this) ----

export async function sendCode(email) {
  if (!inbox) throw new Error('Sending is not set up');
  await inbox.signIn(email);
  return isInstalled()
    ? 'Check your email and type the code here (the link would open the browser, not this app).'
    : 'Check your email: tap the link, or type the code here.';
}

export async function verifyCode(email, code) {
  try { await inbox.verifyCode(email, code); }
  catch (e) { throw new Error('Code not accepted: ' + (e.message || e) + '. Use the newest email, within an hour.'); }
}

// ---- sending ----

/** What the Send button says and whether it can be tapped, from what's on the stage. */
export function sendInfo(s, st, v, gif, stk) {
  const to = st && st.partner ? st.partner.name : null;
  if (!to) return { label: 'Send', can: false };
  if (s.mode === 'video') return v.file ? { label: 'Send this video to ' + to, can: true } : { label: 'Pick a video to send', can: false };
  if (s.mode === 'gif') return gif && gif.ready ? { label: 'Send this GIF to ' + to, can: true } : { label: 'Pick a GIF to send', can: false };
  if (s.mode === 'sticker') return stk && stk.ready ? { label: 'Send this sticker to ' + to, can: true } : { label: 'Pick a sticker to send', can: false };
  if (s.mode === 'message') return { label: 'Send this message to ' + to, can: !!s.msg };
  if (s.mode === 'doodle') return hasInk(s.doodle) ? { label: 'Send this doodle to ' + to, can: true } : { label: 'Draw something to send', can: false };
  if (s.mode === 'countdown') {
    const n = daysUntil(s.visit);
    return n !== null && n >= 0 ? { label: 'Send this countdown to ' + to, can: true } : { label: 'Pick the date to send', can: false };
  }
  return { label: 'Send', can: false };
}

export async function send() {
  set({ sending: true });
  try {
    if (S.mode === 'video') {
      setStatus('Uploading…');
      await inbox.send({ file: videoState.file, src: S.src, view: S.view });
    } else if (S.mode === 'gif') {
      setStatus('Uploading…');
      await inbox.send({ file: gifState.file, src: 'gif' });
    } else if (S.mode === 'sticker') {
      setStatus('Uploading…');
      await inbox.send({ file: stickerState.file, src: 'sticker' });
    } else if (S.mode === 'doodle') {
      setStatus('Sending…');
      await inbox.send({ file: new File([toFileData(S.doodle)], 'doodle.json', { type: 'application/json' }), src: 'doodle' });
    } else if (S.mode === 'countdown') {
      setStatus('');
      await inbox.send({ text: S.visit, src: 'countdown', style: styleOf(S, 'countdown') });
    } else {
      setStatus('');
      await inbox.send({ text: S.msg, style: styleOf(S, 'message') });
    }
    setStatus('Sent');
  } catch (e) { setStatus('Send failed: ' + (e.message || e)); }
  set({ sending: false });
}

// ---- playing a received message ----

export async function play(m) {
  const st = getState().inbox;
  const surprise = isSurprise(S.surprise, m, st.user.id, S.surpriseOwn);
  // Must run inside the tap, before any await (iPhone only shows the motion prompt for a tap).
  const permission = surprise ? askOrientationPermission() : null;
  try {
    setStatus(m.clip_path ? 'Downloading…' : '');
    const blob = await inbox.open(m);
    if (blob && m.src === 'doodle') {
      setSettings({ mode: 'doodle', doodle: cleanStrokes(JSON.parse(await blob.text())) });   // drawn the way it was sent
      set({ holoPage: 'doodle' });
      setStatus('');
    } else if (blob && (m.src === 'gif' || m.src === 'sticker')) {
      const gif = m.src === 'gif';
      setSettings({ mode: m.src });
      await loadReceivedMedia(m.src, gif ? new File([blob], 'gif.mp4', { type: 'video/mp4' }) : new File([blob], 'sticker.gif', { type: 'image/gif' }), !surprise);
      set({ holoPage: m.src });
      setStatus('');
    } else if (blob) {
      setSettings({ mode: 'video', src: m.src, view: m.view });
      set({ holoPage: 'video' });
      const ext = m.clip_path.split('.').pop();
      loadClip(new File([blob], 'clip.' + ext, { type: blob.type || 'video/mp4' }), !surprise);
      setStatus('');
    } else {
      if (m.src === 'countdown') {
        setSettings({ mode: 'countdown', visit: m.text || '', ...stylePatch('countdown', m.style) });   // shown the way it was sent
        set({ holoPage: 'countdown' });
      } else {
        setSettings({ mode: 'message', msg: m.text || '', ...stylePatch('message', m.style) });
        set({ holoPage: 'message' });
      }
    }
    if (surprise) {
      hideControls({ hint: false });
      startSurprise({
        from: nameOf(m.sender), permission,
        onReveal: () => { if (blob) playFromStart(); },
        onCancel: () => { video.pause(); gifVideo.pause(); sticker.pause(); setSettings({ mode: 'message' }); set({ holoPage: null }); showControls(); },
      });
    } else {
      hideControls();   // straight to the hologram
    }
  } catch (e) { setStatus('Could not open: ' + (e.message || e)); }
}

// Revealing can happen seconds after the last tap, when the browser may refuse sound: fall back to muted.
function playFromStart() {
  if (S.mode === 'gif') { gifVideo.currentTime = 0; gifVideo.play().catch(() => {}); return; }
  if (S.mode === 'sticker') { sticker.restart(); sticker.play(); return; }
  if (S.mode === 'doodle') { doodle.restart(); return; }
  video.currentTime = 0;
  video.muted = !S.sound;
  video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
}
