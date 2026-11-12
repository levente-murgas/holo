import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFaceDown, isSurprise } from '../js/surprise-logic.js';

test('isFaceDown: face up and tilted are not, face down is (either sign of beta)', () => {
  assert.equal(isFaceDown(0), false);      // flat, face up
  assert.equal(isFaceDown(60), false);     // held in the hand
  assert.equal(isFaceDown(-90), false);    // standing upright
  assert.equal(isFaceDown(178), true);
  assert.equal(isFaceDown(-175), true);
  assert.equal(isFaceDown(null), false);   // no sensor reading yet
  assert.equal(isFaceDown(NaN), false);
});

test('isFaceDown has hysteresis so it does not flicker while the phone settles', () => {
  assert.equal(isFaceDown(135, false), false); // not yet down: needs past 150
  assert.equal(isFaceDown(135, true), true);   // already down: stays down until below 120
  assert.equal(isFaceDown(115, true), false);
});

test('isSurprise: only for received messages, only when enabled', () => {
  const fromPartner = { sender: 'p' }, fromMe = { sender: 'me' };
  assert.equal(isSurprise(true, fromPartner, 'me'), true);
  assert.equal(isSurprise(true, fromMe, 'me'), false);
  assert.equal(isSurprise(false, fromPartner, 'me'), false);
  assert.equal(isSurprise(true, null, 'me'), false);
});
