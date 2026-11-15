// The hologram controls: what's shown, the video, showing and hiding the controls, going full screen.

import { S } from '../../js/settings.js';
import { video, videoState, loadVideoFile, gifVideo, gifState, loadGifFile, sticker, loadStickerFile } from '../../js/sources.js';
import { fetchGifFile, fetchStickerFile } from '../../js/giphy.js';
import { set, setSettings, getState } from '../store.js';

export function playVideo() {
  if (videoState.ready) video.play().catch(() => {});
}

const setVideoStatus = (status) => set((st) => ({ video: { ...st.video, status } }));

// js/sources.js says when the clip changes or becomes ready; mirror that into the store.
export function watchVideo() {
  const update = () => set((st) => ({
    video: { ...st.video, ready: videoState.ready, file: !!videoState.file },
    gif: { ...st.gif, ready: gifState.ready },
  }));
  document.addEventListener('holo:change', update);
  video.addEventListener('play', () => set({ playing: true }));
  video.addEventListener('pause', () => set({ playing: false }));
  update();
}

export function setMode(mode) {
  setSettings({ mode });
  if (mode === 'video') playVideo();
  if (mode === 'gif' && gifState.ready) gifVideo.play().catch(() => {});
  if (mode === 'sticker') sticker.play();
}

/** Open a page of the Hologram tab (null: back to the gallery). Opening a type puts it on the stage. */
export function openHoloPage(page) {
  set({ holoPage: page });
  if (page) setMode(page);
}

// GIPHY picks: a GIF plays as its MP4 in its own video element, a sticker as its GIF on the sticker player.
const MEDIA = {
  gif: { fetch: fetchGifFile, load: (file, autoplay) => loadGifFile(file, { autoplay }), received: 'Received GIF' },
  sticker: {
    fetch: fetchStickerFile,
    load: async (file, autoplay) => { await loadStickerFile(file); if (autoplay) sticker.play(); else sticker.pause(); },
    received: 'Received sticker',
  },
};

const setMedia = (kind, patch) => set((st) => ({ [kind]: { ...st[kind], ...patch } }));

const picks = { gif: 0, sticker: 0 };
/** Put a GIPHY result on the stage (kind: gif | sticker): fetch it, then play it. */
export async function pickMedia(kind, item) {
  const n = ++picks[kind];
  setMedia(kind, { item, loading: true, status: '' });
  setMode(kind);
  try {
    const file = await MEDIA[kind].fetch(item);
    if (n !== picks[kind]) return;   // another one was picked meanwhile
    await MEDIA[kind].load(file, true);
    setMedia(kind, { loading: false, ready: true });
  } catch (e) {
    if (n === picks[kind]) setMedia(kind, { loading: false, status: e.message || String(e) });
  }
}

/** A received GIF or sticker (Inbox). */
export async function loadReceivedMedia(kind, file, autoplay) {
  ++picks[kind];
  setMedia(kind, { item: { id: 'received', title: MEDIA[kind].received }, loading: false, status: '' });
  await MEDIA[kind].load(file, autoplay);
  setMedia(kind, { ready: true });
}

export function toggle(k) {
  setSettings({ [k]: !S[k] });
  if (k === 'sound') { video.muted = !S.sound; if (S.sound) playVideo(); }
}

export const rotate = () => setSettings({ rot: (S.rot + 90) % 360 });

export function togglePlay() {
  if (!videoState.ready) return;
  if (video.paused) video.play().catch(() => {}); else video.pause();
}

export function pickFile(file) {
  setSettings({ mode: 'video' });
  loadVideoFile(file, { muted: !S.sound, onStatus: setVideoStatus });
}

/** Load a received clip (Inbox): same as picking one, without starting it when a surprise waits. */
export function loadClip(file, autoplay) {
  loadVideoFile(file, { muted: !S.sound, autoplay, onStatus: setVideoStatus });
}

let hintTimer = 0;
export function showControls() { clearTimeout(hintTimer); set({ controls: true, hint: false }); }
export function hideControls({ hint = true } = {}) {
  set({ controls: false, hint });
  clearTimeout(hintTimer);
  if (hint) hintTimer = setTimeout(() => set({ hint: false }), 2500);
}
// Tapping the stage while the controls are up goes to the hologram itself (full screen where the browser allows).
export const toggleControls = () => (getState().controls ? startHologram() : showControls());

export function startHologram() {
  hideControls();
  if (S.mode === 'video' && videoState.ready) { video.muted = !S.sound; video.play().catch(() => {}); }
  if (S.mode === 'gif' && gifState.ready) gifVideo.play().catch(() => {});
  if (S.mode === 'sticker') sticker.play();
  const el = document.documentElement, rf = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rf) { try { const p = rf.call(el); if (p && p.catch) p.catch(() => {}); } catch (_) { /* not allowed here: fine */ } }
}

export const setTab = (tab) => set({ tab });
