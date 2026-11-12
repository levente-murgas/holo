// Push notifications on this device: ask permission, subscribe via the service worker, save the
// subscription in Supabase (through the inbox), and turn it off again.

import { keyToBytes, subscriptionRow, pushStatus, shouldAsk } from './push-logic.js';

const ASKED = 'holo.pushAsked';

// iPhone/iPad only expose PushManager to the installed (home-screen) app.
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const permission = () => (pushSupported() ? Notification.permission : 'default');

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function getPushStatus() {
  return pushStatus({ supported: pushSupported(), permission: permission(), subscribed: !!(await currentSubscription()) });
}

export function markAsked() { try { localStorage.setItem(ASKED, '1'); } catch (_) { /* private mode */ } }
export function shouldAskNow(member) {
  let asked = false;
  try { asked = localStorage.getItem(ASKED) === '1'; } catch (_) { /* private mode */ }
  return shouldAsk({ supported: pushSupported(), permission: permission(), asked, member });
}

// Must be called straight from a tap: Safari only shows the permission prompt for a user gesture,
// so requestPermission() runs before anything else is awaited.
export async function enablePush(inbox) {
  if (!pushSupported()) throw new Error('This browser has no push. On iPhone, add Holo to the Home Screen and open it from there.');
  const perm = await Notification.requestPermission();
  markAsked();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked in the phone settings.' : 'Not allowed.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = await inbox.vapidKey();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) });
  }
  await inbox.saveSubscription(subscriptionRow(sub.toJSON(), navigator.userAgent));
}

export async function disablePush(inbox) {
  const sub = await currentSubscription();
  if (!sub) return;
  await inbox.removeSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}

// After each sign-in: if this device already has a subscription, (re)save it for this user.
// Push services can rotate endpoints, and the row may have been removed when another user signed out.
export async function resyncPush(inbox) {
  if (permission() !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await inbox.saveSubscription(subscriptionRow(sub.toJSON(), navigator.userAgent)).catch(() => {});
}

// Before sign-out: stop this device getting the old user's notifications.
export async function forgetDevice(inbox) {
  const sub = await currentSubscription().catch(() => null);
  if (sub) await inbox.removeSubscription(sub.endpoint).catch(() => {});
}
