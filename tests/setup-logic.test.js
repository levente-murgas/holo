import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, shouldShow, platformOf } from '../js/setup-logic.js';

const fresh = { phone: true, installed: false, configured: true, signedIn: false, push: 'off' };

test('a new phone in the browser goes through every step', () => {
  const seen = []; let s = nextStep(null, fresh);
  while (s) { seen.push(s); s = nextStep(s, fresh); }
  assert.deepEqual(seen, ['welcome', 'install', 'signin', 'notify', 'stand', 'surprise', 'done']);
});

test('steps that are already done are skipped', () => {
  const ready = { ...fresh, installed: true, signedIn: true, push: 'on' };
  assert.equal(nextStep('welcome', ready), 'stand');
  assert.equal(shouldShow('install', { ...fresh, phone: false }), false);          // laptop
  assert.equal(shouldShow('notify', { ...fresh, push: 'unsupported' }), false);    // iPhone browser tab
  assert.equal(shouldShow('notify', { ...fresh, push: 'blocked' }), false);
  assert.equal(nextStep('welcome', { ...fresh, configured: false, installed: true }), 'stand');
  assert.equal(nextStep('done', fresh), null);
});

test('platformOf', () => {
  assert.equal(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios');
  assert.equal(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), 'ios');   // iPad in desktop mode
  assert.equal(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), 'desktop');
  assert.equal(platformOf('Mozilla/5.0 (Linux; Android 15; Pixel 9)'), 'android');
});
