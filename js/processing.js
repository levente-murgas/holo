// Per-frame video processing: crop (4-view videos), brightness cut, face oval, brightness boost.
// The pure functions at the top have no browser dependencies, so Node can test them.

// 4-view videos: a cross on a 3x3 grid inside the centred square. Each view's figure has its head
// pointing to the centre; col/row = grid cell, angle = rotation (radians) that turns that view upright.
export const VIEWS = {
  bottom: { col: 1, row: 2, angle: 0 },
  top:    { col: 1, row: 0, angle: Math.PI },
  left:   { col: 0, row: 1, angle: -Math.PI / 2 },
  right:  { col: 2, row: 1, angle: Math.PI / 2 },
};

// Source rectangle (in video pixels) of one view, plus the rotation that makes it upright.
export function cropRect(videoW, videoH, view) {
  const v = VIEWS[view] || VIEWS.bottom;
  const side = Math.min(videoW, videoH);
  const cell = side / 3;
  return {
    x: (videoW - side) / 2 + v.col * cell,
    y: (videoH - side) / 2 + v.row * cell,
    size: cell,
    angle: v.angle,
  };
}

// Brightness cut: brightness (0..1) at or below thr is invisible (0), at or above thr+soft fully
// visible (1), with a linear ramp in between.
export function cutAlpha(brightness, thr, soft) {
  if (brightness <= thr) return 0;
  if (soft <= 0 || brightness >= thr + soft) return 1;
  return (brightness - thr) / soft;
}

export function smoothstep(a) {
  return a * a * (3 - 2 * a);
}

// Elliptical face mask, 1 inside, fading to 0 at the edge. oval >= 1.58 means "off" (all 1).
export function ovalMask(w, h, oval) {
  const mask = new Float32Array(w * h);
  if (oval >= 1.58) { mask.fill(1); return mask; }
  const cx = w / 2, cy = h * 0.46, rx = w * 0.5 * oval, ry = h * 0.5 * oval, f = 0.22;
  for (let y = 0, i = 0; y < h; y++) {
    const dy = (y - cy) / ry;
    for (let x = 0; x < w; x++, i++) {
      const dx = (x - cx) / rx;
      const d = Math.sqrt(dx * dx + dy * dy);
      mask[i] = d <= 1 - f ? 1 : (d >= 1 ? 0 : (1 - d) / f);
    }
  }
  return mask;
}

const MAX_SIDE = 540;

// Canvas part: returns process(video, opts) -> {c, w, h} drawable, or null when no frame is ready.
// opts: { src, view, thr, soft, oval, gain } — the caller picks the right thr/soft for the video type.
export function createProcessor() {
  const proc = document.createElement('canvas');
  const pctx = proc.getContext('2d', { willReadFrequently: true });
  let mask = null, maskKey = '';

  function size(w, h) {
    if (proc.width !== w || proc.height !== h) { proc.width = w; proc.height = h; }
  }

  return function process(video, o) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const holo = o.src === 'holo1' || o.src === 'holo4';
    let w, h;

    if (o.src === 'holo4') {
      // crop one view out of the cross and rotate it upright
      const r = cropRect(vw, vh, o.view);
      w = h = Math.max(1, Math.round(Math.min(MAX_SIDE, r.size)));
      size(w, h);
      pctx.save(); pctx.translate(w / 2, h / 2); pctx.rotate(r.angle);
      pctx.drawImage(video, r.x, r.y, r.size, r.size, -w / 2, -h / 2, w, h);
      pctx.restore();
    } else {
      const sc = Math.min(1, MAX_SIDE / Math.max(vw, vh));
      w = Math.max(1, Math.round(vw * sc)); h = Math.max(1, Math.round(vh * sc));
      size(w, h);
      pctx.drawImage(video, 0, 0, w, h);
    }

    if (!holo) {
      const key = w + 'x' + h + ':' + o.oval;
      if (key !== maskKey) { mask = ovalMask(w, h, o.oval); maskKey = key; }
    }

    let img;
    try { img = pctx.getImageData(0, 0, w, h); } catch (e) { return { c: proc, w, h }; } // tainted canvas
    const d = img.data, g = o.gain;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const l = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
      let a = cutAlpha(l, o.thr, o.soft);
      if (!holo) a *= mask[p]; // face oval only for own recordings
      const m = smoothstep(a) * g;
      d[i] = Math.min(255, r * m); d[i + 1] = Math.min(255, gg * m); d[i + 2] = Math.min(255, b * m);
    }
    pctx.putImageData(img, 0, 0);
    return { c: proc, w, h };
  };
}
