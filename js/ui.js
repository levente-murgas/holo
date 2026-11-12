// The controls panel: buttons, sliders, file picker, show/hide, fullscreen.

import { S, save, keyFor } from './settings.js';
import { video, videoState, loadVideoFile } from './sources.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const panel = $('#panel'), hint = $('#hint');

export function panelOpen() {
  return !panel.classList.contains('hidden');
}

function playVideo() {
  if (videoState.ready) video.play().catch(() => {});
}

function fmt(k, v) {
  if (k === 'oval' && v >= 1.58) return 'off';
  return (+v).toFixed(2);
}

// Push the current settings into every control.
export function sync() {
  document.body.dataset.mode = S.mode; document.body.dataset.layout = S.layout; document.body.dataset.src = S.src;
  $$('.seg').forEach((seg) => {
    const k = seg.dataset.k;
    Array.from(seg.children).forEach((b) => b.classList.toggle('on', b.dataset.v === S[k]));
  });
  $$('input[type=range]').forEach((r) => { r.value = S[keyFor(r.dataset.k)]; });
  $$('[data-o]').forEach((o) => { o.textContent = fmt(o.dataset.o, S[keyFor(o.dataset.o)]); });
  $$('[data-t]').forEach((c) => c.classList.toggle('on', !!S[c.dataset.t]));
  $('#rot').textContent = 'Rotate ' + S.rot + '°';
  $('#msg').value = S.msg;
  $$('.only-video-inline').forEach((e) => { e.style.display = S.mode === 'video' ? '' : 'none'; });
  $('#play').style.display = S.mode === 'video' ? '' : 'none';
  document.dispatchEvent(new Event('holo:change'));
}

let hintTimer = null;
export function showPanel() { panel.classList.remove('hidden'); hint.style.opacity = 0; }
export function hidePanel() {
  panel.classList.add('hidden'); hint.style.opacity = 1;
  clearTimeout(hintTimer); hintTimer = setTimeout(() => { hint.style.opacity = 0; }, 2500);
}

export function initUI(stageCanvas) {
  $$('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S[seg.dataset.k] = b.dataset.v; save(); sync();
    if (S.mode === 'video') playVideo();
  }));

  $$('input[type=range]').forEach((r) => r.addEventListener('input', () => {
    const k = keyFor(r.dataset.k); S[k] = +r.value; save();
    const o = $('[data-o="' + r.dataset.k + '"]'); if (o) o.textContent = fmt(r.dataset.k, S[k]);
  }));

  $$('[data-t]').forEach((c) => c.addEventListener('click', () => {
    const k = c.dataset.t; S[k] = !S[k]; save(); sync();
    if (k === 'sound') { video.muted = !S.sound; if (S.sound) playVideo(); }
  }));

  $('#rot').addEventListener('click', () => { S.rot = (S.rot + 90) % 360; save(); sync(); });
  $('#msg').addEventListener('input', (e) => { S.msg = e.target.value; save(); document.dispatchEvent(new Event('holo:change')); });
  $('#play').addEventListener('click', () => {
    if (!videoState.ready) return;
    if (video.paused) video.play().catch(() => {}); else video.pause();
  });

  $('#file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    S.mode = 'video'; save(); sync();
    loadVideoFile(f, { muted: !S.sound, onStatus: (t) => { $('#status').textContent = t; } });
  });

  $('#go').addEventListener('click', () => {
    hidePanel();
    if (S.mode === 'video' && videoState.ready) { video.muted = !S.sound; video.play().catch(() => {}); }
    const el = document.documentElement, rf = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rf) { try { const p = rf.call(el); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ } }
  });

  stageCanvas.addEventListener('click', () => { if (panelOpen()) hidePanel(); else showPanel(); });

  sync();
}
