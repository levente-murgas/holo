import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToBytes, subscriptionRow, pushStatus, shouldAsk } from '../js/push-logic.js';

test('keyToBytes decodes base64url without padding', () => {
  const bytes = Uint8Array.from({ length: 65 }, (_, i) => (i * 37 + 4) % 256); // a VAPID public key is 65 bytes
  const b64url = Buffer.from(bytes).toString('base64url');
  assert.ok(!b64url.includes('=') && /[-_]/.test(b64url + '-')); // sanity: url-safe, unpadded
  assert.deepEqual(keyToBytes(b64url), bytes);
});

test('subscriptionRow flattens the subscription and rejects incomplete ones', () => {
  const json = { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'P', auth: 'A' } };
  assert.deepEqual(subscriptionRow(json, 'UA'), { endpoint: json.endpoint, p256dh: 'P', auth: 'A', user_agent: 'UA' });
  assert.equal(subscriptionRow(json, 'x'.repeat(500)).user_agent.length, 200);
  assert.throws(() => subscriptionRow({ endpoint: 'e', keys: { p256dh: 'P' } }));
  assert.throws(() => subscriptionRow(null));
});

test('pushStatus', () => {
  assert.equal(pushStatus({ supported: false, permission: 'granted', subscribed: true }), 'unsupported');
  assert.equal(pushStatus({ supported: true, permission: 'denied', subscribed: false }), 'blocked');
  assert.equal(pushStatus({ supported: true, permission: 'granted', subscribed: true }), 'on');
  assert.equal(pushStatus({ supported: true, permission: 'granted', subscribed: false }), 'off');
  assert.equal(pushStatus({ supported: true, permission: 'default', subscribed: false }), 'off');
});

test('shouldAsk only once, only for a signed-in member who has not decided yet', () => {
  const base = { supported: true, permission: 'default', asked: false, member: true };
  assert.equal(shouldAsk(base), true);
  assert.equal(shouldAsk({ ...base, asked: true }), false);           // pressed "Not now" before
  assert.equal(shouldAsk({ ...base, permission: 'granted' }), false); // already on
  assert.equal(shouldAsk({ ...base, permission: 'denied' }), false);  // blocked: settings explains
  assert.equal(shouldAsk({ ...base, supported: false }), false);      // iPhone browser tab
  assert.equal(shouldAsk({ ...base, member: false }), false);
});
