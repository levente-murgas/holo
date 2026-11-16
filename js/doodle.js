// Doodles: drawn with a finger on the Doodle page, sent as a small JSON file, and played back on the stage stroke by
// stroke, the way they were drawn.
//
// A doodle is a list of strokes in a 600×400 space (the stage's text canvases use the same). A stroke is
// { c, s, p }: c its colour, or null for the eraser; s its width; p its points, flat [x0, y0, x1, y1, ...].
// The eraser is a stroke too, drawn as "take away what's here" (destination-out), and played back in its turn. So it
// rubs out only what it passes over, like a real eraser, never whole lines, and the replay shows the rubbing out.

export const W = 600, H = 400;
export const SIZES = { thin: 4, medium: 9, thick: 18 };
export const ERASER = 3;               // the eraser is this many times wider than the pen at the same size
const MAX_STROKES = 600, MAX_POINTS = 60000;
const HEX = /^#[0-9a-f]{6}$/i;

/** A doodle from anywhere (a received file, old settings) made safe: strokes, or [] if it isn't one. */
export function cleanStrokes(d) {
  const list = Array.isArray(d) ? d : d && Array.isArray(d.strokes) ? d.strokes : [];
  const out = [];
  let points = 0;
  for (const st of list.slice(0, MAX_STROKES)) {
    if (!st || !Array.isArray(st.p) || st.p.length < 2) continue;
    const p = [];
    for (let i = 0; i + 1 < st.p.length && points < MAX_POINTS; i += 2, points++) {
      const x = +st.p[i], y = +st.p[i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) break;
      p.push(Math.max(-50, Math.min(W + 50, x)), Math.max(-50, Math.min(H + 50, y)));
    }
    if (!p.length) continue;
    const s = Math.max(1, Math.min(80, +st.s || SIZES.medium));
    out.push({ c: st.c === null ? null : HEX.test(st.c || '') ? st.c.toLowerCase() : '#ffffff', s, p });
  }
  return out;
}

/** Anything to see? (Only eraser strokes, or nothing, leaves the page black.) */
export const hasInk = (strokes) => strokes.some((st) => st.c !== null);

/** The file that's sent. */
export const toFileData = (strokes) => JSON.stringify({ v: 1, w: W, h: H, strokes });

// ---- drawing ----
// A stroke is drawn in steps, so playback can stop anywhere: step 0 is a dot at the first point, step i (1..n-1)
// the curve up to between points i-1 and i (smoothed through the midpoints), step n the last bit to the end.

export const stepsOf = (st) => (st.p.length / 2 >= 2 ? st.p.length / 2 + 1 : 1);

/** Draw steps [from, to) of a stroke on ctx (in doodle units: set the transform for the canvas's size first). */
export function drawSteps(ctx, st, from, to) {
  const p = st.p, n = p.length / 2;
  ctx.globalCompositeOperation = st.c === null ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = st.c || '#000';
  ctx.lineWidth = st.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const x = (i) => p[2 * i], y = (i) => p[2 * i + 1];
  const mx = (i) => (x(i) + x(i + 1)) / 2, my = (i) => (y(i) + y(i + 1)) / 2;
  for (let k = from; k < to; k++) {
    ctx.beginPath();
    if (k === 0) { ctx.arc(x(0), y(0), st.s / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    if (k === 1) { ctx.moveTo(x(0), y(0)); ctx.lineTo(mx(0), my(0)); }
    else if (k < n) { ctx.moveTo(mx(k - 2), my(k - 2)); ctx.quadraticCurveTo(x(k - 1), y(k - 1), mx(k - 1), my(k - 1)); }
    else { ctx.moveTo(mx(n - 2), my(n - 2)); ctx.lineTo(x(n - 1), y(n - 1)); }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Draw a whole doodle onto a (transparent) canvas, k canvas pixels per doodle unit. */
export function drawAll(ctx, strokes, k = 1) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  strokes.forEach((st) => drawSteps(ctx, st, 0, stepsOf(st)));
}

// ---- playback ----

const HOLD = 3000;   // the finished doodle stays this long before it's drawn again

/** When each stroke starts and how fast it's drawn: about as fast as a hand, all of it in 1.5 to 7 seconds. */
export function timeline(strokes) {
  const total = strokes.reduce((a, st) => a + stepsOf(st), 0);
  const step = total ? Math.max(1500 / total, Math.min(10, 7000 / total)) : 0;
  const gap = strokes.length ? Math.min(160, 2500 / strokes.length) : 0;
  let t = 0;
  const starts = strokes.map((st) => { const s = t; t += stepsOf(st) * step + gap; return s; });
  return { starts, step, end: t, loop: t + HOLD };
}

/** The stage's doodle: the whole drawing while it's being edited, drawn again stroke by stroke as a hologram. */
export function createDoodlePlayer() {
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const octx = out.getContext('2d');
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;   // the ink, with transparent holes where it's erased
  const lctx = layer.getContext('2d');
  let strokes = [], tl = timeline([]), drawn = [], startAt = 0, mode = '', shown = null;

  function set(next) {
    if (next === strokes) return;
    strokes = next; tl = timeline(strokes); shown = null; mode = '';
  }
  function restart(now = performance.now()) {
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, H);
    drawn = strokes.map(() => 0); startAt = now;
  }

  /** The canvas for now (animate: replaying; otherwise the whole drawing). Null when there's nothing to show. */
  function frame(now = performance.now(), animate = true) {
    if (!hasInk(strokes)) return null;
    if (!animate) {
      if (mode !== 'still' || shown !== strokes) { drawAll(lctx, strokes); shown = strokes; mode = 'still'; }
    } else {
      if (mode !== 'play') { mode = 'play'; restart(now); }
      let t = now - startAt;
      if (t > tl.loop) { restart(now); t = 0; }
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      strokes.forEach((st, i) => {
        const want = Math.max(0, Math.min(stepsOf(st), Math.floor((t - tl.starts[i]) / tl.step) + 1));
        if (want > drawn[i]) { drawSteps(lctx, st, drawn[i], want); drawn[i] = want; }
      });
    }
    octx.fillStyle = '#000'; octx.fillRect(0, 0, W, H);
    octx.drawImage(layer, 0, 0);
    return { c: out, w: W, h: H };
  }

  return { set, frame, restart: () => { mode = ''; } };
}
