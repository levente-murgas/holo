// Things that can be shown: the video element (and loading a file into it), GIFs and stickers, the test pattern,
// the message card and the countdown.

import { createStickerPlayer } from './sticker.js';
import { FONTS, cleanStyle, fontCss, daysUntil, countdownLines } from './textstyle.js';

export const video = document.createElement('video');
video.setAttribute('playsinline', '');
video.playsInline = true; video.loop = true; video.muted = true; video.preload = 'auto';

export const videoState = { ready: false, file: null };   // file: the loaded clip (used for sending)

// Load a picked/recorded file into the video element. onStatus(text) reports progress to the UI.
export function loadVideoFile(file, { muted, onStatus, autoplay = true }) {
  try { if (video.src) URL.revokeObjectURL(video.src); } catch (_) { /* ignore */ }
  videoState.ready = false;
  videoState.file = file;
  document.dispatchEvent(new Event('holo:change'));
  onStatus('Loading ' + file.name + '…');
  video.src = URL.createObjectURL(file);
  video.muted = muted;
  video.onloadeddata = () => {
    videoState.ready = true;
    document.dispatchEvent(new Event('holo:change'));
    onStatus(file.name + ' · ' + video.videoWidth + '×' + video.videoHeight + ' · ' + Math.round(video.duration || 0) + 's');
  };
  video.onerror = () => onStatus('Could not play that file. Try a .mov or .mp4 from the camera.');
  if (autoplay) video.play().catch(() => onStatus('Tap “Play / pause” to start.'));
}

// GIFs (as GIPHY's MP4s) play in their own element: no sound, always looping.
export const gifVideo = document.createElement('video');
gifVideo.setAttribute('playsinline', '');
gifVideo.playsInline = true; gifVideo.loop = true; gifVideo.muted = true; gifVideo.preload = 'auto';

export const gifState = { ready: false, file: null };

export function loadGifFile(file, { autoplay = true } = {}) {
  try { if (gifVideo.src) URL.revokeObjectURL(gifVideo.src); } catch (_) { /* ignore */ }
  gifState.ready = false;
  gifState.file = file;
  document.dispatchEvent(new Event('holo:change'));
  gifVideo.src = URL.createObjectURL(file);
  gifVideo.onloadeddata = () => { gifState.ready = true; document.dispatchEvent(new Event('holo:change')); };
  if (autoplay) gifVideo.play().catch(() => {});
}

// Stickers: the GIF decoded and played on a canvas (js/sticker.js), so its transparency survives.
export const sticker = createStickerPlayer();
export const stickerState = { file: null };

export async function loadStickerFile(file) {
  sticker.load(await file.arrayBuffer());
  stickerState.file = file;
  document.dispatchEvent(new Event('holo:change'));
}

// What the stage shows besides video: words, in the face and colour picked (js/textstyle.js), warm brass by default.
// The test is the same words, fixed: if they read normally and the right way up in the reflection,
// rotation and mirroring are right (text shows both a flip and a turn at a glance).

export const TEST_TEXT = 'miss you already';

// A face only loads once something asks for it, and drawing with it on a canvas doesn't ask; so ask here.
// Until it arrives the canvas uses the fallback; it's drawn every frame, so it switches as soon as it lands.
const asked = new Set();
function ensureFont(key) {
  if (asked.has(key) || !document.fonts) return;
  asked.add(key);
  document.fonts.load(fontCss(key, 100)).catch(() => {});
}

// Wrap words into at most `max` lines that fit the width.
function wrap(c, text, width, max) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const tst = line ? line + ' ' + w : w;
    if (c.measureText(tst).width > width && line) { lines.push(line); line = w; } else line = tst;
  });
  if (line) lines.push(line);
  return lines.slice(0, max);
}

function drawWords(cv, text, style) {
  const { font, color } = cleanStyle(style);
  ensureFont(font);
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.font = fontCss(font, 100);
  const lines = wrap(c, text, W * 0.86, 3);
  const lh = 100 * FONTS[font].lh, top = H / 2 - ((lines.length - 1) * lh) / 2;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color;
  lines.forEach((l, i) => c.fillText(l, W / 2, top + i * lh));
  return { c: cv, w: W, h: H };
}

// The countdown: the number of days, big, and a small line under it.
function drawCountdown(cv, date, style, now) {
  const { font, color } = cleanStyle(style);
  ensureFont(font);
  const { big, small } = countdownLines(daysUntil(date, now));
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color;
  let px = 190;
  c.font = fontCss(font, px);
  while (c.measureText(big).width > W * 0.9 && px > 60) { px -= 10; c.font = fontCss(font, px); }   // "See you" is wider than "12"
  const sm = 52, gap = 18;
  const bigH = px * FONTS[font].scale, smH = sm * FONTS[font].scale;
  const top = H / 2 - (bigH + gap + smH) / 2;
  c.fillText(big, W / 2, top + bigH / 2);
  c.font = fontCss(font, sm);
  c.fillText(small, W / 2, top + bigH + gap + smH / 2);
  return { c: cv, w: W, h: H };
}

const testC = document.createElement('canvas'); testC.width = 600; testC.height = 400;
const msgC = document.createElement('canvas'); msgC.width = 600; msgC.height = 400;
const countC = document.createElement('canvas'); countC.width = 600; countC.height = 400;

// Drawn every frame (cheap), so the words switch to their face as soon as it has loaded.
export const testPattern = () => drawWords(testC, TEST_TEXT);
export const renderMessage = (t, text, style) => drawWords(msgC, text, style);
export const renderCountdown = (date, style) => drawCountdown(countC, date, style);
