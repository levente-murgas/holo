// Live call state machine (pure, tested in Node). The engine in call.js feeds it events and acts on
// the result; the UI renders `phase`.
//
//   idle ─dial→ outgoing ─(accept)→ connecting ─connected→ active
//   idle ─(ring)→ incoming ─answer→ connecting
//   any call phase ─hangup / (hangup) / timeout / failed / (decline) / (busy)→ ended ─reset→ idle
// (x) = message from the other phone.

export const RING_TIMEOUT_MS = 45000;   // give up ringing after this
export const RING_REPEAT_MS = 2000;     // the caller repeats "ring" so a phone that opens Holo late still sees it

export const IDLE = { phase: 'idle', callId: null, reason: '' };
const live = (s) => s.phase !== 'idle' && s.phase !== 'ended';
const ended = (s, reason) => ({ ...s, phase: 'ended', reason });

export function callReducer(s, ev) {
  switch (ev.type) {
    case 'dial': return s.phase === 'idle' || s.phase === 'ended' ? { phase: 'outgoing', callId: ev.callId, reason: '' } : s;
    case 'answer': return s.phase === 'incoming' ? { ...s, phase: 'connecting' } : s;
    case 'connected': return s.phase === 'connecting' ? { ...s, phase: 'active' } : s;
    case 'hangup': return live(s) ? ended(s, s.phase === 'incoming' ? 'Declined' : 'Call ended') : s;
    case 'timeout':
      if (s.phase === 'outgoing') return ended(s, 'No answer');
      if (s.phase === 'incoming') return ended(s, 'Missed call');
      return s;
    case 'failed': return live(s) ? ended(s, 'Connection lost') : s;
    case 'reset': return s.phase === 'ended' ? IDLE : s;
    case 'elsewhere': return s.phase === 'incoming' ? ended(s, 'Answered on another device') : s;
    case 'remote': return onRemote(s, ev.msg);
    default: return s;
  }
}

function onRemote(s, m) {
  if (!m || !m.type || !m.callId) return s;
  if (m.type === 'ring') {
    if (s.phase === 'idle' || (s.phase === 'ended' && s.callId !== m.callId)) return { phase: 'incoming', callId: m.callId, reason: '' };
    return s;   // already ringing for this call, or busy with another (see replyTo)
  }
  if (m.callId !== s.callId) return s;   // stale message from an older call
  switch (m.type) {
    case 'accept': return s.phase === 'outgoing' ? { ...s, phase: 'connecting' } : s;
    case 'decline': return s.phase === 'outgoing' ? ended(s, 'Declined') : s;
    case 'busy': return s.phase === 'outgoing' ? ended(s, 'Busy') : s;
    case 'hangup': return live(s) ? ended(s, s.phase === 'incoming' ? 'Missed call' : 'Call ended') : s;
    default: return s;
  }
}

// A ring for a different call while we're in one: tell the caller we're busy.
export function replyTo(s, m) {
  if (m && m.type === 'ring' && live(s) && m.callId !== s.callId) return { type: 'busy', callId: m.callId };
  return null;
}

// "2:05"
export function formatDuration(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
