// Entry point: load settings, set up the screen and controls, run the per-frame loop.

import { S, loadSettings, keyFor } from './settings.js';
import { createProcessor } from './processing.js';
import { video, videoState, testPattern, renderMessage } from './sources.js';
import { createStage, drawFrame } from './layout.js';
import { initUI, panelOpen } from './ui.js';
import { initInbox, refreshSendButton } from './inbox-ui.js';
import { initPWA } from './pwa.js';
import { initSurprise, surpriseActive } from './surprise.js';
import { initSetup } from './setup.js';

initPWA();
loadSettings();
initSurprise();
const canvas = document.getElementById('stage');
const stage = createStage(canvas);
const processVideo = createProcessor();
initUI(canvas);
initSetup();
document.addEventListener('holo:change', refreshSendButton);
initInbox();

function currentSource(t) {
  if (surpriseActive()) return null;   // Surprise mode: keep the message hidden until it's revealed
  if (S.mode === 'video') {
    if (!videoState.ready) return null;
    return processVideo(video, {
      src: S.src, view: S.view, oval: S.oval, gain: S.gain,
      thr: S[keyFor('thr')], soft: S[keyFor('soft')],
    });
  }
  if (S.mode === 'message') return renderMessage(t, S.msg);
  return testPattern;
}

function frame(t) {
  drawFrame(stage, currentSource(t), S, t, panelOpen());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
