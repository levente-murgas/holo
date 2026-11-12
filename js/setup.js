// First-time setup screen: welcome → install → sign in → notifications → stand → Surprise mode → done.
// Shown once per device (the installed iPhone app counts as its own device: it has separate storage,
// so after "Add to Home Screen" the setup simply continues in the app). Steps already done are skipped.

import { S, save } from './settings.js';
import { sync, hidePanel } from './ui.js';
import { STEPS, nextStep, platformOf } from './setup-logic.js';
import { isInstalled, canPromptInstall, promptInstall } from './pwa.js';
import { getPushStatus, enablePush, markAsked } from './push.js';
import { askOrientationPermission } from './surprise.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const DONE = 'holo.setupDone';

let inbox = null, st = null, step = null;
const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints || 0);

export const setupActive = () => !$('#setup').hidden;

async function context() {
  return {
    phone: platform !== 'desktop',
    installed: isInstalled(),
    configured: !!inbox,
    signedIn: !!(st && st.user && st.me),
    push: inbox ? await getPushStatus().catch(() => 'off') : 'unsupported',
  };
}

function show(id) {
  step = id;
  $$('#setup .step').forEach((el) => { el.hidden = el.dataset.step !== id; });
  $('#setup').classList.toggle('on-stage', id === 'stand');
  $('#setup').classList.remove('peek');
  const shown = STEPS.indexOf(id);
  $('#setupDots').innerHTML = STEPS.map((_, i) => '<i class="' + (i <= shown ? 'on' : '') + '"></i>').join('');
  $('#setupSkip').hidden = id === 'done';
  if (id === 'install') renderInstall();
  if (id === 'stand') { S.mode = 'test'; save(); sync(); }
}

async function next() { show((await nextStep(step, await context())) || 'done'); }

function finish() {
  try { localStorage.setItem(DONE, '1'); } catch (_) { /* private mode */ }
  $('#setup').hidden = true;
  step = null;
}

function renderInstall() {
  const how = {
    ios: 'In Safari, tap the Share button (the square with the arrow), scroll down and tap “Add to Home Screen”, then “Add”.',
    android: 'In Chrome, open the menu (⋮) and tap “Install app” or “Add to Home screen”.',
    desktop: '',
  }[platform];
  $('#setupInstallHow').textContent = how + ' Holo then opens full screen, keeps the screen on, and can send you notifications.';
  $('#setupInstallBtn').hidden = !canPromptInstall();
  $('#setupInstallThen').textContent = platform === 'ios'
    ? 'Then open Holo from its new icon: the setup continues there.'
    : 'Then open Holo from its new icon.';
}

export async function openSetup() {
  $('#setup').hidden = false;
  hidePanel();
  show('welcome');
}

// Called by the inbox whenever its state changes; signing in moves the setup on by itself.
export function setupInboxState(state) {
  const wasIn = !!(st && st.me);
  st = state;
  if (step === 'signin' && !wasIn && st && st.me) next();
  if (step === 'signin' && st && st.notMember) $('#setupSigninStatus').textContent = 'Signed in, but this email is not on Holo\'s members list.';
}

export function setupInbox(theInbox) { inbox = theInbox; }

export function initSetup() {
  $$('#setup [data-next]').forEach((b) => b.addEventListener('click', next));
  $('#setupSkip').addEventListener('click', finish);
  $('#setupFinish').addEventListener('click', finish);

  $('#setupInstallBtn').addEventListener('click', async () => { if (await promptInstall()) next(); });

  $('#setupSendCode').addEventListener('click', async () => {
    const email = $('#setupEmail').value.trim(); if (!email || !inbox) return;
    $('#setupSigninStatus').textContent = 'Sending…';
    try {
      await inbox.signIn(email);
      $('#setupCodeBox').hidden = false;
      $('#setupSigninStatus').textContent = 'Check your email and type the code here.';
    } catch (e) { $('#setupSigninStatus').textContent = 'Could not send: ' + (e.message || e); }
  });
  $('#setupVerify').addEventListener('click', async () => {
    const email = $('#setupEmail').value.trim(), code = $('#setupCode').value.replace(/\s/g, '');
    if (!email || !code) return;
    try { await inbox.verifyCode(email, code); $('#setupSigninStatus').textContent = 'Signed in ♥'; }
    catch (e) { $('#setupSigninStatus').textContent = 'Code not accepted: ' + (e.message || e) + '. Use the newest email, within an hour.'; }
  });

  $('#setupPushLater').addEventListener('click', markAsked);   // don't ask again with the dialog
  $('#setupPushOn').addEventListener('click', async () => {
    try { await enablePush(inbox); next(); }
    catch (e) { $('#setupPushStatus').textContent = (e.message || e) + ' You can try again later in Settings.'; }
  });

  $('#setupRot').addEventListener('click', () => { S.rot = (S.rot + 90) % 360; save(); sync(); });
  $('#setupMirror').addEventListener('click', () => { S.mirror = !S.mirror; save(); sync(); });
  $('#setupPeek').addEventListener('click', (e) => { e.stopPropagation(); $('#setup').classList.add('peek'); });
  $('#setup').addEventListener('click', (e) => { if (e.target === $('#setup') && $('#setup').classList.contains('peek')) $('#setup').classList.remove('peek'); });

  $('#setupSurpriseOn').addEventListener('click', () => {
    S.surprise = true; save();
    askOrientationPermission();   // from this tap, so iPhone can show its motion prompt
    next();
  });

  let done = false;
  try { done = localStorage.getItem(DONE) === '1'; } catch (_) { /* private mode */ }
  if (!done) openSetup();
}
