// Things that can be shown: the video element (and loading a file into it), the test pattern, the message card.

import { createStickerPlayer } from './sticker.js';

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

// What the stage shows besides video: words in one warm colour, the controls' brass lit up.
// The test is the same words, fixed: if they read normally and the right way up in the reflection,
// rotation and mirroring are right (text shows both a flip and a turn at a glance).

const INK = '#f2dcae';
const FONT = '"Geist Variable", -apple-system, "SF Pro Display", Helvetica, Arial, sans-serif';
export const TEST_TEXT = 'miss you already';

function drawWords(cv, text) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.font = '500 100px ' + FONT;
  const words = (text || '').split(/\s+/).filter(Boolean);
  let lines = [], line = '';
  words.forEach((w) => {
    const tst = line ? line + ' ' + w : w;
    if (c.measureText(tst).width > W * 0.86 && line) { lines.push(line); line = w; } else line = tst;
  });
  if (line) lines.push(line);
  lines = lines.slice(0, 3);
  const lh = 116, top = H / 2 - ((lines.length - 1) * lh) / 2;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK;
  lines.forEach((l, i) => c.fillText(l, W / 2, top + i * lh));
  return { c: cv, w: W, h: H };
}

const testC = document.createElement('canvas'); testC.width = 600; testC.height = 400;
const msgC = document.createElement('canvas'); msgC.width = 600; msgC.height = 400;

// Drawn every frame (cheap), so the words switch to Geist as soon as the font has loaded.
export const testPattern = () => drawWords(testC, TEST_TEXT);
export const renderMessage = (t, text) => drawWords(msgC, text);
