// First-time setup: welcome → install → sign in → notifications → stand → Surprise mode → done.
// Shown once per device (the installed iPhone app counts as its own device: it has separate storage,
// so after "Add to Home Screen" the setup simply continues in the app). Steps already done are skipped.

import { nextStep, platformOf } from '../../js/setup-logic.js';
import { isInstalled } from '../../js/pwa.js';
import { getPushStatus, enablePush, markAsked } from '../../js/push.js';
import { set, getState, setSettings } from '../store.js';
import { askOrientationPermission } from './surprise.js';
import { getInbox } from './inbox.js';
import { showControls, hideControls } from './stage.js';
import { refreshPush } from './account.js';

const DONE = 'holo.setupDone';

export const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints || 0);

async function context() {
  const inbox = getInbox(), st = getState().inbox;
  return {
    phone: platform !== 'desktop',
    installed: isInstalled(),
    configured: !!inbox,
    signedIn: !!(st && st.user && st.me),
    push: inbox ? await getPushStatus().catch(() => 'off') : 'unsupported',
  };
}

function show(id) {
  set({ setup: id, setupPeek: false });
}

export async function nextSetup() {
  const from = getState().setup;
  show((await nextStep(from, await context())) || 'done');
}

export function finishSetup() {
  try { localStorage.setItem(DONE, '1'); } catch (_) { /* private mode */ }
  set({ setup: null });
  showControls();
}

export function openSetup() {
  hideControls({ hint: false });
  show('welcome');
}

export const peekSetup = (setupPeek) => set({ setupPeek });

// Called by the inbox whenever its state changes; signing in moves the setup on by itself.
let wasIn = false;
export function setupInboxState(st) {
  const isIn = !!(st && st.me);
  if (getState().setup === 'signin' && !wasIn && isIn) nextSetup();
  wasIn = isIn;
}

export async function setupPushOn() {
  try { await enablePush(getInbox()); refreshPush(); nextSetup(); }
  catch (e) { return (e.message || e) + ' You can try again later in Settings.'; }
  return '';
}

export function setupPushLater() { markAsked(); nextSetup(); }   // and don't ask again with the dialog

export function setupSurpriseOn() {
  setSettings({ surprise: true });
  askOrientationPermission();   // from this tap, so iPhone can show its motion prompt
  nextSetup();
}

export function initSetup() {
  let done = false;
  try { done = localStorage.getItem(DONE) === '1'; } catch (_) { /* private mode */ }
  if (!done) openSetup();
}
