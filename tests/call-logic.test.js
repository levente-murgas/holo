import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callReducer, replyTo, formatDuration, IDLE } from '../js/call-logic.js';

const run = (s, ...evs) => evs.reduce(callReducer, s);
const remote = (type, callId = 'c1') => ({ type: 'remote', msg: { type, callId } });

test('caller: dial → accepted → connected → hang up → reset', () => {
  let s = run(IDLE, { type: 'dial', callId: 'c1' });
  assert.equal(s.phase, 'outgoing');
  s = run(s, remote('accept'));
  assert.equal(s.phase, 'connecting');
  s = run(s, { type: 'connected' });
  assert.equal(s.phase, 'active');
  s = run(s, { type: 'hangup' });
  assert.deepEqual([s.phase, s.reason], ['ended', 'Call ended']);
  assert.deepEqual(run(s, { type: 'reset' }), IDLE);
});

test('callee: ring → answer → connected; the other side hangs up', () => {
  let s = run(IDLE, remote('ring'));
  assert.deepEqual([s.phase, s.callId], ['incoming', 'c1']);
  s = run(s, remote('ring'));                       // repeated rings change nothing
  assert.equal(s.phase, 'incoming');
  s = run(s, { type: 'answer' }, { type: 'connected' }, remote('hangup'));
  assert.deepEqual([s.phase, s.reason], ['ended', 'Call ended']);
});

test('no answer, missed, declined, busy, connection lost', () => {
  assert.equal(run(IDLE, { type: 'dial', callId: 'c1' }, { type: 'timeout' }).reason, 'No answer');
  assert.equal(run(IDLE, remote('ring'), { type: 'timeout' }).reason, 'Missed call');
  assert.equal(run(IDLE, remote('ring'), remote('hangup')).reason, 'Missed call');   // caller gave up
  assert.equal(run(IDLE, remote('ring'), { type: 'hangup' }).reason, 'Declined');    // I declined
  assert.equal(run(IDLE, { type: 'dial', callId: 'c1' }, remote('decline')).reason, 'Declined');
  assert.equal(run(IDLE, { type: 'dial', callId: 'c1' }, remote('busy')).reason, 'Busy');
  assert.equal(run(IDLE, { type: 'dial', callId: 'c1' }, remote('accept'), { type: 'failed' }).reason, 'Connection lost');
});

test('messages from another call are ignored, and a second caller gets "busy"', () => {
  const s = run(IDLE, { type: 'dial', callId: 'c1' }, remote('accept'), { type: 'connected' });
  assert.equal(run(s, remote('hangup', 'old')).phase, 'active');
  assert.equal(run(s, remote('ring', 'c2')).phase, 'active');
  assert.deepEqual(replyTo(s, { type: 'ring', callId: 'c2' }), { type: 'busy', callId: 'c2' });
  assert.equal(replyTo(s, { type: 'ring', callId: 'c1' }), null);
  assert.equal(replyTo(IDLE, { type: 'ring', callId: 'c2' }), null);
});

test('a new ring right after a call ended starts ringing again; the old call\'s ring does not', () => {
  const done = run(IDLE, remote('ring', 'c1'), { type: 'timeout' });
  assert.equal(run(done, remote('ring', 'c1')).phase, 'ended');
  assert.equal(run(done, remote('ring', 'c2')).phase, 'incoming');
});

test('answered on my other device stops the ringing here', () => {
  const s = run(IDLE, remote('ring'), { type: 'elsewhere' });
  assert.deepEqual([s.phase, s.reason], ['ended', 'Answered on another device']);
  assert.equal(run(IDLE, { type: 'elsewhere' }).phase, 'idle');
});

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(125400), '2:05');
  assert.equal(formatDuration(-5), '0:00');
});
