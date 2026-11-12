// Settings page (gear in the panel header) and the one-time "Turn on notifications?" dialog.

import { getPushStatus, enablePush, disablePush, resyncPush, forgetDevice, shouldAskNow, markAsked } from './push.js';
import { S, save } from './settings.js';
import { askOrientationPermission } from './surprise.js';
import { tryLatestAsSurprise } from './inbox-ui.js';

const $ = (s) => document.querySelector(s);

let inbox = null, st = null, seenUser = null;

const STATE_TEXT = {
  on: 'On for this device.',
  off: 'Off for this device.',
  blocked: 'Blocked. Allow notifications for Holo in the phone settings, then come back here.',
  unsupported: 'Not available here. On iPhone: Safari → Share → Add to Home Screen, then open Holo from its icon.',
};

function setPushStatus(t) { $('#pushStatus').textContent = t || ''; }
const signedInMember = () => !!(st && st.user && st.me);

async function renderSettings() {
  const member = signedInMember();
  $('#surpriseToggle').textContent = S.surprise ? 'On' : 'Off';
  $('#surpriseToggle').classList.toggle('on', !!S.surprise);
  $('#accountRow').hidden = !(st && st.user);
  if (st && st.user) $('#accountWho').textContent = 'Signed in as ' + (st.me ? st.me.name + ' (' + st.user.email + ')' : st.user.email);

  if (!inbox) { $('#pushState').textContent = 'Sending is not set up yet.'; return; }
  if (!member) {
    $('#pushState').textContent = 'Sign in under Inbox first.';
    $('#pushOn').hidden = $('#pushOff').hidden = $('#pushTest').hidden = true;
    return;
  }
  const s = await getPushStatus().catch(() => 'off');
  $('#pushState').textContent = STATE_TEXT[s];
  $('#pushOn').hidden = s !== 'off';
  $('#pushOff').hidden = s !== 'on';
  $('#pushTest').hidden = s !== 'on';
}

async function turnOn() {
  setPushStatus('Turning on…');
  try { await enablePush(inbox); setPushStatus(''); }
  catch (e) { setPushStatus('Could not turn on: ' + (e.message || e)); }
  renderSettings();
}

// Called by the inbox whenever its state changes.
export function onInboxState(state) {
  st = state;
  const uid = signedInMember() ? st.user.id : null;
  if (uid && uid !== seenUser) {
    // Just signed in (or the app opened already signed in): keep this device's subscription saved,
    // and ask about notifications once per device.
    resyncPush(inbox);
    if (shouldAskNow(true)) $('#pushDialog').hidden = false;
  }
  seenUser = uid;
  if (!$('#settings').hidden) renderSettings();
}

export function initSettings(theInbox) {
  inbox = theInbox;

  $('#openSettings').addEventListener('click', () => { $('#settings').hidden = false; setPushStatus(''); renderSettings(); });
  $('#closeSettings').addEventListener('click', () => { $('#settings').hidden = true; });

  $('#surpriseToggle').addEventListener('click', () => {
    S.surprise = !S.surprise; save();
    if (S.surprise) askOrientationPermission(); // ask now, from this tap, rather than at the surprise itself
    renderSettings();
  });

  $('#surpriseTry').addEventListener('click', () => {
    $('#surpriseTryStatus').textContent = signedInMember() ? tryLatestAsSurprise() : 'Sign in under Inbox first.';
  });

  $('#pushOn').addEventListener('click', turnOn);
  $('#pushOff').addEventListener('click', async () => {
    try { await disablePush(inbox); setPushStatus(''); } catch (e) { setPushStatus('Could not turn off: ' + (e.message || e)); }
    renderSettings();
  });
  $('#pushTest').addEventListener('click', async () => {
    setPushStatus('Sending…');
    try {
      const r = await inbox.notify({ action: 'test' });
      setPushStatus(r.sent ? 'Sent to ' + r.sent + ' device' + (r.sent > 1 ? 's' : '') + '. It should arrive in a few seconds.' : 'No device received it (' + JSON.stringify(r) + ').');
    } catch (e) { setPushStatus('Test failed: ' + (e.message || e)); }
  });

  $('#pushDialogYes').addEventListener('click', async () => {
    $('#pushDialog').hidden = true;
    try { await enablePush(inbox); }
    catch (e) { $('#inboxStatus').textContent = 'Notifications: ' + (e.message || e); }
  });
  $('#pushDialogNo').addEventListener('click', () => { markAsked(); $('#pushDialog').hidden = true; });

  $('#signout').addEventListener('click', async () => {
    await forgetDevice(inbox);
    await inbox.signOut();
    $('#settings').hidden = true;
  });
}
