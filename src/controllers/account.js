// Settings tab: notifications on this device (and the one-time "Turn on notifications?" dialog),
// Surprise mode, call testing, and signing out.

import { getPushStatus, enablePush, disablePush, resyncPush, forgetDevice, shouldAskNow, markAsked } from '../../js/push.js';
import { S } from '../../js/settings.js';
import { set, getState, setSettings } from '../store.js';
import { askOrientationPermission } from './surprise.js';
import { getInbox } from './inbox.js';
import { refreshCall } from './call.js';

let seenUser = null;
const setPushStatus = (pushStatus) => set({ pushStatus: pushStatus || '' });
const member = (st = getState().inbox) => !!(st && st.user && st.me);

export async function refreshPush() {
  if (!getInbox()) return set({ push: 'none' });
  if (!member()) return set({ push: 'signin' });
  set({ push: await getPushStatus().catch(() => 'off') });
}

// Called by the inbox whenever its state changes.
export function pushInboxState(st) {
  const inbox = getInbox();
  if (!inbox) return;   // called again once the inbox exists
  const uid = member(st) ? st.user.id : null;
  if (uid && uid !== seenUser) {
    // Just signed in (or the app opened already signed in): keep this device's subscription saved,
    // and ask about notifications once per device (the setup asks itself).
    resyncPush(inbox);
    if (shouldAskNow(true) && !getState().setup) set({ pushDialog: true });
  }
  seenUser = uid;
  refreshPush();
}

export async function turnOnPush() {
  setPushStatus('Turning on…');
  try { await enablePush(getInbox()); setPushStatus(''); }
  catch (e) { setPushStatus('Could not turn on: ' + (e.message || e)); }
  refreshPush();
}

export async function turnOffPush() {
  try { await disablePush(getInbox()); setPushStatus(''); }
  catch (e) { setPushStatus('Could not turn off: ' + (e.message || e)); }
  refreshPush();
}

export async function testPush() {
  setPushStatus('Sending…');
  try {
    const r = await getInbox().notify({ action: 'test' });
    setPushStatus(r.sent ? 'Sent to ' + r.sent + ' device' + (r.sent > 1 ? 's' : '') + '. It should arrive in a few seconds.' : 'No device received it (' + JSON.stringify(r) + ').');
  } catch (e) { setPushStatus('Test failed: ' + (e.message || e)); }
}

export async function answerPushDialog(yes) {
  set({ pushDialog: false });
  if (!yes) { markAsked(); return; }
  try { await enablePush(getInbox()); }
  catch (e) { set({ inboxStatus: 'Notifications: ' + (e.message || e) }); }
  refreshPush();
}

export function toggleSurprise() {
  setSettings({ surprise: !S.surprise });
  if (S.surprise) askOrientationPermission();   // ask now, from this tap, rather than at the surprise itself
}

export function toggleSurpriseOwn() {
  setSettings({ surpriseOwn: !S.surpriseOwn });
  if (S.surpriseOwn && S.surprise) askOrientationPermission();
}

export function toggleCallSelf() {
  setSettings({ callSelf: !S.callSelf });
  refreshCall();
}

export async function signOut() {
  const inbox = getInbox();
  await forgetDevice(inbox);
  await inbox.signOut();
}
