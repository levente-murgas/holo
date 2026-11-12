// Pure helpers for push notifications (no browser APIs, so they can be tested in Node).

// The public VAPID key comes as base64url text; pushManager.subscribe() wants raw bytes.
export function keyToBytes(base64url) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// The row saved in push_subscriptions, from a PushSubscription's toJSON().
export function subscriptionRow(json, userAgent = '') {
  if (!json || !json.endpoint || !json.keys || !json.keys.p256dh || !json.keys.auth) throw new Error('Incomplete push subscription');
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: userAgent.slice(0, 200) };
}

// What this device can do. supported: browser has push at all (iPhone: only in the installed app).
// permission: Notification.permission. subscribed: a push subscription exists on this device.
export function pushStatus({ supported, permission, subscribed }) {
  if (!supported) return 'unsupported';
  if (permission === 'denied') return 'blocked';
  if (permission === 'granted' && subscribed) return 'on';
  return 'off';
}

// Show the "Turn on notifications?" dialog once per device, right after a successful sign-in.
export function shouldAsk({ supported, permission, asked, member }) {
  return !!(member && supported && permission === 'default' && !asked);
}
