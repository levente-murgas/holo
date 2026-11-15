import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanStyle, daysUntil, countdownLines, INK } from '../js/textstyle.js';

test('cleanStyle keeps known fonts and hex colours, falls back otherwise', () => {
  assert.deepEqual(cleanStyle({ font: 'script', color: '#FF5FA2' }), { font: 'script', color: '#ff5fa2' });
  assert.deepEqual(cleanStyle({ font: 'comic', color: 'red' }), { font: 'classic', color: INK });
  assert.deepEqual(cleanStyle(null), { font: 'classic', color: INK });
});

test('daysUntil counts whole local days', () => {
  const now = new Date(2026, 10, 15, 23, 30);   // late evening still counts as that day
  assert.equal(daysUntil('2026-11-25', now), 10);
  assert.equal(daysUntil('2026-11-16', now), 1);
  assert.equal(daysUntil('2026-11-15', now), 0);
  assert.equal(daysUntil('2026-11-14', now), -1);
  assert.equal(daysUntil('2027-03-30', new Date(2027, 2, 27)), 3);   // across the spring clock change
  assert.equal(daysUntil('soon', now), null);
});

test('countdownLines', () => {
  assert.deepEqual(countdownLines(10), { big: '10', small: 'days until we meet' });
  assert.deepEqual(countdownLines(1), { big: '1', small: 'day until we meet' });
  assert.equal(countdownLines(0).big, 'Today');
  assert.equal(countdownLines(-2).big, 'See you');
});
