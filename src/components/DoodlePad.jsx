// The drawing pad: a black window the shape of the stage's doodle (3:2). One finger draws (or rubs out); the page
// doesn't scroll while it's touched. The finished stroke is handed up; the drawing itself lives in the settings.

import { useEffect, useRef } from 'react';
import { W, H, ERASER, drawAll, drawSteps, stepsOf } from '../../js/doodle.js';
import { cn } from './ui.jsx';

const K = 2;   // canvas pixels per doodle unit: sharp on a phone's screen

/** strokes: the drawing; tool: { color, size, erase }; onStroke(stroke) when a finger lifts. */
export function DoodlePad({ strokes, tool, onStroke, className }) {
  const cv = useRef(null);
  const live = useRef(null);   // the stroke under the finger: { id, st, drawn }
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // The drawing changed from outside (undo, clear, a received doodle, or a stroke just finished): draw it all again.
  useEffect(() => {
    const ctx = cv.current.getContext('2d');
    drawAll(ctx, strokes, K);
  }, [strokes]);

  const at = (e) => {
    const r = cv.current.getBoundingClientRect();
    const half = (v) => Math.round(v * 2) / 2;   // half a unit is finer than a finger, and keeps the file small
    return [half(((e.clientX - r.left) / r.width) * W), half(((e.clientY - r.top) / r.height) * H)];
  };

  function draw() {
    const l = live.current, ctx = cv.current.getContext('2d');
    ctx.setTransform(K, 0, 0, K, 0, 0);
    // the last step (the very end of the line) waits until the finger lifts: the line may still go on
    const upto = stepsOf(l.st) - (l.st.p.length >= 4 ? 1 : 0);
    if (upto > l.drawn) { drawSteps(ctx, l.st, l.drawn, upto); l.drawn = upto; }
  }

  function down(e) {
    if (live.current) return;   // one finger at a time
    e.preventDefault();
    cv.current.setPointerCapture(e.pointerId);
    const t = toolRef.current;
    live.current = { id: e.pointerId, st: { c: t.erase ? null : t.color, s: t.erase ? t.size * ERASER : t.size, p: at(e) }, drawn: 0 };
    draw();
  }

  function move(e) {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    // a fast finger reports several positions per frame: take them all, so curves stay round
    const evs = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    for (const ev of evs.length ? evs : [e.nativeEvent]) {
      const [x, y] = at(ev), p = l.st.p;
      if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) >= 1.5) p.push(x, y);
    }
    draw();
  }

  function up(e) {
    const l = live.current;
    if (!l || l.id !== e.pointerId) return;
    live.current = null;
    const ctx = cv.current.getContext('2d');
    ctx.setTransform(K, 0, 0, K, 0, 0);
    drawSteps(ctx, l.st, l.drawn, stepsOf(l.st));
    onStroke(l.st);
  }

  return (
    <canvas
      ref={cv} width={W * K} height={H * K}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={cn('block aspect-[3/2] w-full touch-none select-none rounded-control bg-black [-webkit-touch-callout:none]', className)}
    />
  );
}
