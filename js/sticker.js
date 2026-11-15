// Sticker player: GIPHY stickers are GIFs with a transparent background, which is exactly what a hologram wants
// (transparent = black = invisible in the reflection). A video can't carry transparency, so the GIF itself is
// decoded here (gifuct-js) and played frame by frame onto a canvas over black, which the stage then draws like a clip.

import { parseGIF, decompressFrames } from 'gifuct-js';

export function createStickerPlayer() {
  const out = document.createElement('canvas');      // what the stage reads: black + the current frame
  const octx = out.getContext('2d');
  const comp = document.createElement('canvas');     // the GIF's own canvas, transparent, frames composited on it
  const cctx = comp.getContext('2d');
  const patch = document.createElement('canvas');    // one frame's patch (putImageData ignores alpha, drawImage doesn't)
  const pctx = patch.getContext('2d');

  let frames = [], i = -1, due = 0, restore = null, prev = null;
  let playing = true, startAt = 0;

  function load(buffer) {
    const gif = parseGIF(buffer);
    frames = decompressFrames(gif, true);
    if (!frames.length) throw new Error('That sticker has no frames');
    out.width = comp.width = gif.lsd.width;
    out.height = comp.height = gif.lsd.height;
    restart();
  }

  function restart() {
    cctx.clearRect(0, 0, comp.width, comp.height);
    i = -1; due = 0; restore = null; prev = null;
    startAt = performance.now();
  }

  function draw(f) {
    // undo the previous frame as its disposal asks: 2 = clear its area, 3 = put back what was under it
    if (prev && prev.disposalType === 2) cctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
    if (prev && prev.disposalType === 3 && restore) cctx.putImageData(restore, 0, 0);
    restore = f.disposalType === 3 ? cctx.getImageData(0, 0, comp.width, comp.height) : null;

    const { width, height, top, left } = f.dims;
    if (patch.width !== width || patch.height !== height) { patch.width = width; patch.height = height; }
    pctx.putImageData(new ImageData(f.patch, width, height), 0, 0);
    cctx.drawImage(patch, left, top);
    prev = f;

    octx.fillStyle = '#000'; octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(comp, 0, 0);
  }

  /** Advance to the frame for now; returns the canvas (with width/height, like a video's videoWidth). */
  function frame(now = performance.now()) {
    if (!frames.length) return null;
    if (!playing && i >= 0) return out;
    if (i < 0) { draw(frames[0]); i = 0; due = startAt + delay(frames[0]); }
    let guard = frames.length;
    while (now >= due && guard--) {
      i = (i + 1) % frames.length;
      if (i === 0) { cctx.clearRect(0, 0, comp.width, comp.height); prev = null; restore = null; }
      draw(frames[i]);
      due += delay(frames[i]);
    }
    if (now - due > 1000) due = now;   // after a pause in drawing (tab hidden), don't race to catch up
    return out;
  }

  return {
    load, restart, frame,
    get ready() { return frames.length > 0; },
    play() { playing = true; due = performance.now(); },
    pause() { playing = false; },
  };
}

// Browsers play GIF delays under 20ms as 100ms; do the same, or some stickers spin far too fast.
const delay = (f) => (f.delay < 20 ? 100 : f.delay);
