// Entry point: load settings, start the engines, run the per-frame hologram loop, and mount the screens.

import './styles.css';
import { createRoot } from 'react-dom/client';
import { S, loadSettings, keyFor } from '../js/settings.js';
import { createProcessor } from '../js/processing.js';
import { video, videoState, gifVideo, gifState, sticker, testPattern, renderMessage } from '../js/sources.js';
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
  if (S.mode === 'message') return renderMessage(t, S.msg);
  return testPattern();
}

function frame(t) {
  drawFrame(stage, currentSource(t), S, t, getState().controls);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

createRoot(document.getElementById('root')).render(<App />);
