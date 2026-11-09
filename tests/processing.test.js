import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropRect, cutAlpha, VIEWS } from '../js/processing.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('cropRect: square video, each view is the middle cell of an edge', () => {
  // 900x900 → cells of 300
  assert.deepEqual(cropRect(900, 900, 'bottom'), { x: 300, y: 600, size: 300, angle: 0 });
  assert.deepEqual(cropRect(900, 900, 'top'),    { x: 300, y: 0,   size: 300, angle: Math.PI });
  assert.deepEqual(cropRect(900, 900, 'left'),   { x: 0,   y: 300, size: 300, angle: -Math.PI / 2 });
  assert.deepEqual(cropRect(900, 900, 'right'),  { x: 600, y: 300, size: 300, angle: Math.PI / 2 });
});

test('cropRect: 16:9 video uses the centred square', () => {
  // 1920x1080 → square 1080 starting at x=420, cells of 360
  assert.deepEqual(cropRect(1920, 1080, 'bottom'), { x: 780, y: 720, size: 360, angle: 0 });
  assert.deepEqual(cropRect(1920, 1080, 'left'),   { x: 420, y: 360, size: 360, angle: -Math.PI / 2 });
  assert.deepEqual(cropRect(1920, 1080, 'right'),  { x: 1140, y: 360, size: 360, angle: Math.PI / 2 });
});

test('cropRect: portrait video uses the centred square', () => {
  // 1080x1920 → square 1080 starting at y=420
  assert.deepEqual(cropRect(1080, 1920, 'top'), { x: 360, y: 420, size: 360, angle: Math.PI });
});

test('cropRect: crop always stays inside the frame', () => {
  for (const [w, h] of [[900, 900], [1920, 1080], [1080, 1920], [641, 359]]) {
    for (const view of Object.keys(VIEWS)) {
      const r = cropRect(w, h, view);
      assert.ok(r.x >= 0 && r.y >= 0, `${view} ${w}x${h} starts inside`);
      assert.ok(r.x + r.size <= w + 1e-9 && r.y + r.size <= h + 1e-9, `${view} ${w}x${h} ends inside`);
    }
  }
});

test('cropRect: unknown view falls back to bottom', () => {
  assert.deepEqual(cropRect(900, 900, 'nonsense'), cropRect(900, 900, 'bottom'));
});

test('cutAlpha: at or below the threshold is invisible', () => {
  assert.equal(cutAlpha(0, 0.1, 0.1), 0);
  assert.equal(cutAlpha(0.1, 0.1, 0.1), 0);
  // compressed "black" (16/255 ≈ 0.063) with the holo defaults (cut 0.05, soft 0.06) is mostly cut
  assert.ok(cutAlpha(16 / 255, 0.05, 0.06) < 0.25);
});

test('cutAlpha: at or above threshold + softness is fully visible', () => {
  assert.equal(cutAlpha(0.2, 0.1, 0.1), 1);
  assert.equal(cutAlpha(1, 0.1, 0.1), 1);
});

test('cutAlpha: linear ramp inside the soft edge', () => {
  close(cutAlpha(0.15, 0.1, 0.1), 0.5);
  close(cutAlpha(0.125, 0.1, 0.1), 0.25);
});

test('cutAlpha: zero softness is a hard cut', () => {
  assert.equal(cutAlpha(0.1, 0.1, 0), 0);
  assert.equal(cutAlpha(0.1001, 0.1, 0), 1);
});
