// Settings: defaults, load/save in localStorage, and which cut values apply to the current video type.

const STORAGE_KEY = 'holo.v1';

export const DEF = {
  mode: 'test', layout: 'single', rot: 180, mirror: true, sound: false,
  thr: 0.16, soft: 0.12,      // background cut for "My recording"
  hthr: 0.05, hsoft: 0.06,    // separate background cut for holo videos
  oval: 0.95, gain: 1.4, size: 0.9, pos: 0, gap: 1,
  msg: 'Miss you already',
  src: 'rec',                 // video type: rec | holo1 | holo4
  view: 'bottom',             // which view of a 4-view video: bottom | top | left | right
  surprise: false,            // Surprise mode: received messages open only once the phone is face down in the stand
  surpriseOwn: false,         // ...and the messages I sent too (handy for testing alone)
  callSelf: false,            // Call button calls your own other devices instead (testing alone)
};

// The live settings object. Modules read and write it directly; call save() after a change.
export const S = {};

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (e) { /* private mode etc. */ }
  for (const k in DEF) S[k] = (k in saved) ? saved[k] : DEF[k];
  return S;
}

export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
}

export function isHolo(s = S) {
  return s.src === 'holo1' || s.src === 'holo4';
}

// The "Background cut" and "Edge softness" sliders edit thr/soft for recordings and hthr/hsoft for holo videos.
export function keyFor(k, s = S) {
  return (isHolo(s) && (k === 'thr' || k === 'soft')) ? 'h' + k : k;
}
