import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanStrokes, hasInk, stepsOf, timeline, toFileData, W, H } from '../js/doodle.js';

test('cleanStrokes keeps good strokes, the eraser and its order', () => {
  const s = cleanStrokes({ strokes: [{ c: '#FF0000', s: 9, p: [1, 2, 3, 4] }, { c: null, s: 27, p: [5, 6] }] });
  assert.deepEqual(s, [{ c: '#ff0000', s: 9, p: [1, 2, 3, 4] }, { c: null, s: 27, p: [5, 6] }]);
});

test('cleanStrokes drops junk and clamps the rest', () => {
  assert.deepEqual(cleanStrokes(null), []);
  assert.deepEqual(cleanStrokes('nope'), []);
  assert.deepEqual(cleanStrokes([{ p: [] }, { c: '#fff', p: [1] }, 7]), []);
  const [st] = cleanStrokes([{ c: 'red', s: 500, p: [-999, 9999, 'x', 1] }]);
  assert.equal(st.c, '#ffffff');      // not a hex colour: white
  assert.equal(st.s, 80);
  assert.deepEqual(st.p, [-50, H + 50]);   // stops at the first bad number
});

test('the file round-trips', () => {
  const strokes = [{ c: '#ffe066', s: 4, p: [10, 10, 20, 30, 40, 35] }];
  const d = JSON.parse(toFileData(strokes));
  assert.equal(d.w, W); assert.equal(d.h, H);
  assert.deepEqual(cleanStrokes(d), strokes);
});

test('hasInk: an eraser alone shows nothing', () => {
  assert.equal(hasInk([]), false);
  assert.equal(hasInk([{ c: null, s: 9, p: [1, 1] }]), false);
  assert.equal(hasInk([{ c: '#ffffff', s: 9, p: [1, 1] }]), true);
});

test('steps: a dot is one, a line of n points is n + 1', () => {
  assert.equal(stepsOf({ p: [1, 1] }), 1);
  assert.equal(stepsOf({ p: [1, 1, 2, 2, 3, 3] }), 4);
});

test('playback draws strokes one after another, in 1.5 to 7 seconds', () => {
  const dot = { c: '#fff', s: 4, p: [1, 1] };
  const long = { c: '#fff', s: 4, p: Array.from({ length: 4000 }, (_, i) => i % 600) };
  const short = timeline([dot]);
  assert.ok(short.end >= 1500 && short.end < 1500 + 200);
  const big = timeline([long, dot, long]);
  assert.ok(big.starts[0] < big.starts[1] && big.starts[1] < big.starts[2]);
  assert.ok(big.end <= 7000 + 3 * 160);
  assert.ok(big.loop > big.end);
});
