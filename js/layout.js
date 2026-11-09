// Drawing a source onto the screen: single pane (CD case) or 4-sided pyramid, with rotate/mirror/size/position.

export function createStage(canvas) {
  const st = { canvas, ctx: canvas.getContext('2d'), W: 0, H: 0, dpr: 1 };
  function resize() {
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.W = window.innerWidth; st.H = window.innerHeight;
    canvas.width = Math.round(st.W * st.dpr); canvas.height = Math.round(st.H * st.dpr);
  }
  window.addEventListener('resize', resize);
  resize();
  return st;
}

function drawCopy(ctx, src, x, y, ang, sc, mirror) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(mirror ? -sc : sc, sc);
  ctx.drawImage(src.c, -src.w / 2, -src.h / 2, src.w, src.h);
  ctx.restore();
}

// src: {c, w, h} or null. showGuide: draw the pyramid centre square (only while the panel is open).
export function drawFrame(st, src, s, t, showGuide) {
  const { ctx, canvas, W, H, dpr } = st;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // video brightness is applied during processing; other sources use a canvas filter
  const gainFilter = (s.mode !== 'video' && s.gain !== 1);
  if (gainFilter) ctx.filter = 'brightness(' + s.gain + ')';
  const bob = s.mode === 'message' ? Math.sin(t / 900) * 6 : 0;
  const rot = s.rot * Math.PI / 180;

  if (s.layout === 'single') {
    if (src) {
      let sw = src.w, sh = src.h;
      if (s.rot % 180 !== 0) { sw = src.h; sh = src.w; }
      const sc = Math.min(W * 0.92 / sw, H * 0.5 / sh) * s.size;
      drawCopy(ctx, src, W / 2, H / 2 + s.pos * H * 0.4 + bob, rot, sc, s.mirror);
    }
  } else {
    const m = Math.min(W, H), cx = W / 2, cy = H / 2 + s.pos * H * 0.2, dist = m * 0.27 * s.gap;
    if (showGuide) {
      ctx.filter = 'none'; ctx.strokeStyle = '#1d262c'; ctx.lineWidth = 1;
      ctx.strokeRect(cx - m * 0.06, cy - m * 0.06, m * 0.12, m * 0.12);
      if (gainFilter) ctx.filter = 'brightness(' + s.gain + ')';
    }
    if (src) {
      const box = m * 0.36 * s.size, sc2 = Math.min(box / src.w, box / src.h);
      for (let k = 0; k < 4; k++) {
        const th = k * Math.PI / 2, r = dist + bob;
        drawCopy(ctx, src, cx - Math.sin(th) * r, cy + Math.cos(th) * r, th + Math.PI + (rot - Math.PI), sc2, s.mirror);
      }
    }
  }
  ctx.filter = 'none';
}
