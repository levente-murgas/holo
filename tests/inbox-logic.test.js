import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipPath, mergeMessages, unseenCount, partnerOf, timeAgo } from '../js/inbox-logic.js';

test('clipPath: sender folder first, keeps a sane lowercase extension', () => {
  assert.equal(clipPath('u1', 'abc', 'IMG_0001.MOV'), 'u1/abc.mov');
  assert.equal(clipPath('u1', 'abc', 'dance.mp4'), 'u1/abc.mp4');
});

test('clipPath: missing or odd extension falls back to mp4', () => {
  assert.equal(clipPath('u1', 'abc', 'noext'), 'u1/abc.mp4');
  assert.equal(clipPath('u1', 'abc', ''), 'u1/abc.mp4');
  assert.equal(clipPath('u1', 'abc', '../../evil.weird/'), 'u1/abc.mp4');
});

const msg = (id, created_at, extra = {}) => ({ id, created_at, sender: 'a', recipient: 'b', ...extra });

test('mergeMessages: newest first, no duplicates', () => {
  const list = [msg(1, '2026-11-01T10:00:00Z')];
  const out = mergeMessages(list, [msg(2, '2026-11-02T10:00:00Z'), msg(1, '2026-11-01T10:00:00Z')]);
  assert.deepEqual(out.map((m) => m.id), [2, 1]);
});

test('mergeMessages: a partial update (seen_at) merges into the existing message', () => {
  const out = mergeMessages([msg(1, '2026-11-01T10:00:00Z', { text: 'hi' })], [{ id: 1, seen_at: '2026-11-03T00:00:00Z' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, 'hi');
  assert.equal(out[0].seen_at, '2026-11-03T00:00:00Z');
});

test('mergeMessages: realtime event arriving during the catch-up fetch is not duplicated', () => {
  const live = mergeMessages([], [msg(3, '2026-11-04T10:00:00Z')]);
  const out = mergeMessages(live, [msg(3, '2026-11-04T10:00:00Z'), msg(2, '2026-11-03T10:00:00Z')]);
  assert.deepEqual(out.map((m) => m.id), [3, 2]);
});

test('unseenCount: only unseen messages addressed to me', () => {
  const list = [
    msg(1, 't', { recipient: 'me' }),
    msg(2, 't', { recipient: 'me', seen_at: 'x' }),
    msg(3, 't', { recipient: 'other' }),
  ];
  assert.equal(unseenCount(list, 'me'), 1);
});

test('partnerOf: the other member, or me when alone', () => {
  const a = { user_id: 'a', name: 'A' }, b = { user_id: 'b', name: 'B' };
  assert.equal(partnerOf([a, b], 'a'), b);
  assert.equal(partnerOf([a], 'a'), a);
  assert.equal(partnerOf([], 'a'), null);
});

test('timeAgo: readable buckets', () => {
  const now = Date.parse('2026-11-09T12:00:00Z');
  assert.equal(timeAgo('2026-11-09T11:59:30Z', now), 'just now');
  assert.equal(timeAgo('2026-11-09T11:55:00Z', now), '5 min ago');
  assert.equal(timeAgo('2026-11-09T09:00:00Z', now), '3 h ago');
  assert.equal(timeAgo('2026-11-08T12:00:00Z', now), 'yesterday');
  assert.equal(timeAgo('2026-11-06T12:00:00Z', now), '3 days ago');
});
