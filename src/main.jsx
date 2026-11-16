// Entry point: load settings, start the engines, run the per-frame hologram loop, and mount the screens.

import './styles.css';
import { createRoot } from 'react-dom/client';
import { S, loadSettings, keyFor } from '../js/settings.js';
import { createProcessor } from '../js/processing.js';
import { styleOf } from '../js/textstyle.js';
import { video, videoState, gifVideo, gifState, sticker, doodle, testPattern, renderMessage, renderCountdown } from '../js/sources.js';
import { createStage, drawFrame } from '../js/layout.js';
import { initPWA } from '../js/pwa.js';
import { getState, subscribe, refreshSettings } from './store.js';
import { watchVideo } from './controllers/stage.js';
import { surpriseActive } from './controllers/surprise.js';
import { initInbox } from './controllers/inbox.js';
import { initSetup } from './controllers/setup.js';
import { initCall, callHologram } from './controllers/call.js';
import { App } from './App.jsx';

initPWA();

// iPhone, installed app: the page can come out shorter than the screen (by about the status bar's height), so
// anything pinned to the bottom stops short with a black band under it. Measure the shortfall and let the
// controls reach past it (Controls.jsx). Where the page fills the screen this is 0, so it fixes itself.
function measureViewportGap() {
  const ios = navigator.standalone === true;
  const portrait = window.innerHeight > window.innerWidth;
  const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const gap = ios ? Math.max(0, full - window.innerHeight) : 0;
  document.documentElement.style.setProperty('--viewport-gap', (gap < 120 ? gap : 0) + 'px');
}
measureViewportGap();
window.addEventListener('resize', measureViewportGap);
loadSettings();
if (S.layout !== 'single') S.layout = 'single';   // the pyramid option is gone from the controls
refreshSettings();
watchVideo();
initCall();
initSetup();
initInbox();

const canvas = document.getElementById('stage');
const stage = createStage(canvas);

// While the controls are open, the stage shrinks into the space above them, so the hologram stays in view
// while it's being tuned (Controls.jsx works out the size). Only the picture on screen moves: what's drawn is the same.
const syncPreview = () => { const st = getState(); canvas.classList.toggle('preview', st.controls && !st.setup); };
subscribe(syncPreview);
syncPreview();
const processVideo = createProcessor();

function currentSource(t) {
  const call = callHologram();          // live call with the phone in the stand: show the other person
  if (call) {
    if (call.text) return renderMessage(t, call.text);
    return processVideo(call.video, {
      src: 'rec', view: 'bottom', oval: S.oval, gain: S.gain, thr: S.thr, soft: S.soft,
    });
  }
  if (getState().setup === 'stand') return testPattern();   // setup lines up the stand on fixed words
  if (surpriseActive()) return null;   // Surprise mode: keep the message hidden until it's revealed
  if (S.mode === 'video') {
    if (!videoState.ready) return null;
    return processVideo(video, {
      src: S.src, view: S.view, oval: S.oval, gain: S.gain,
      thr: S[keyFor('thr')], soft: S[keyFor('soft')],
    });
  }
  if (S.mode === 'gif') {
    if (!gifState.ready) return null;
    return processVideo(gifVideo, { src: 'gif', view: 'bottom', oval: 1.6, gain: S.gain, thr: S.gthr, soft: S.gsoft });
  }
  if (S.mode === 'sticker') {
    const c = sticker.frame();
    if (!c) return null;
    return processVideo(c, { src: 'sticker', view: 'bottom', oval: 1.6, gain: S.gain, thr: S.sthr, soft: S.ssoft });
  }
  if (S.mode === 'message') return renderMessage(t, S.msg, styleOf(S, 'message'));
  if (S.mode === 'countdown') return renderCountdown(S.visit, styleOf(S, 'countdown'));
  if (S.mode === 'doodle') {
    // while it's being drawn the stage shows all of it; as a hologram it's drawn again, stroke by stroke
    doodle.set(S.doodle);
    return doodle.frame(t, !getState().controls);
  }
  return testPattern();
}

function frame(t) {
  drawFrame(stage, currentSource(t), S, t, getState().controls);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

createRoot(document.getElementById('root')).render(<App />);
