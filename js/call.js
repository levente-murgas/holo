// Live call engine: WebRTC between the two phones, set up over a private Supabase Realtime
// Broadcast channel ('holo-call'). Audio flows both ways the whole call. Video is "take turns":
// a phone held in the hand films its owner; a phone lying face down in the stand stops sending
// video (its camera would only see the inside of the stand) and shows the other person as a hologram.

import { callReducer, replyTo, IDLE, RING_TIMEOUT_MS, RING_REPEAT_MS } from './call-logic.js';

export const remoteVideo = document.createElement('video');
remoteVideo.playsInline = true; remoteVideo.autoplay = true; remoteVideo.setAttribute('playsinline', '');

const MEDIA = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
};

// inbox: from createInbox(); me/partner: member rows; onChange(view) whenever anything visible changes.
// view: { phase, reason, callId, startedAt, muted, inStand, remoteInStand, localStream, remoteReady, relay }
//
// Every message carries the sending device (one person may have Holo open on two devices) and, once
// the two phones have found each other, `to`: the device it is meant for. A ring goes to every device.
export function createCall({ inbox, me, partner, onChange }) {
  const sb = inbox.client;
  const device = crypto.randomUUID();
  const selfCall = partner.user_id === me.user_id;   // only one member: call your own other device (testing)
  let peerDevice = null;
  let s = IDLE;
  let pc = null, local = null, pendingIce = [], channel = null;
  let ringTimer = 0, ringRepeat = 0, lostTimer = 0;
  const view = { startedAt: 0, muted: false, inStand: false, remoteInStand: false, remoteReady: false };

  const emit = () => onChange({ ...s, ...view, localStream: local });

  function dispatch(ev) {
    const before = s;
    s = callReducer(s, ev);
    if (s === before) return;
    if (s.phase === 'active' && before.phase !== 'active') view.startedAt = Date.now();
    if (s.phase !== 'outgoing') { clearInterval(ringRepeat); ringRepeat = 0; }
    if (s.phase !== 'outgoing' && s.phase !== 'incoming') clearTimeout(ringTimer);
    if (s.phase === 'ended') {
      cleanup();
      setTimeout(() => { dispatch({ type: 'reset' }); }, 2500);
    }
    emit();
  }

  const send = (msg) => channel && channel.send({
    type: 'broadcast', event: 'call',
    payload: { to: peerDevice || undefined, ...msg, user: me.user_id, device },
  });

  async function onMessage(m) {
    if (!m || m.device === device) return;
    if (m.user === me.user_id && !selfCall) {
      // My own other device: if it answered the call that is ringing here, stop ringing.
      if (m.type === 'accept' && m.callId === s.callId) dispatch({ type: 'elsewhere' });
      return;
    }
    if (m.to && m.to !== device) return;
    const reply = replyTo(s, m);
    if (reply) { channel.send({ type: 'broadcast', event: 'call', payload: { ...reply, to: m.device, user: me.user_id, device } }); return; }
    // A second device of theirs answered too late: tell it the call is taken.
    if (m.type === 'accept' && m.callId === s.callId && peerDevice && m.device !== peerDevice) {
      send({ type: 'hangup', callId: s.callId, to: m.device }); return;
    }
    const before = s;
    dispatch({ type: 'remote', msg: m });
    if (m.callId !== s.callId) return;
    if ((m.type === 'ring' || m.type === 'accept') && !peerDevice && s.phase !== 'ended') peerDevice = m.device;

    if (m.type === 'ring' && before.phase !== 'incoming' && s.phase === 'incoming') {
      clearTimeout(ringTimer);
      ringTimer = setTimeout(() => dispatch({ type: 'timeout' }), RING_TIMEOUT_MS);
    }
    if (m.type === 'accept' && s.phase === 'connecting') await startAsCaller();
    if (m.type === 'offer' && pc) await onOffer(m.sdp);
    if (m.type === 'answer' && pc) { await pc.setRemoteDescription(m.sdp); flushIce(); }
    if (m.type === 'ice' && m.candidate) {
      if (pc && pc.remoteDescription) pc.addIceCandidate(m.candidate).catch(() => {});
      else pendingIce.push(m.candidate);
    }
    if (m.type === 'stand') { view.remoteInStand = !!m.inStand; emit(); }
  }

  function flushIce() {
    for (const c of pendingIce) pc.addIceCandidate(c).catch(() => {});
    pendingIce = [];
  }

  // ---- media + peer connection ----
  async function getMedia() {
    if (local) return local;
    local = await navigator.mediaDevices.getUserMedia(MEDIA);
    applyStand();
    applyMute();
    emit();
    return local;
  }

  async function makePeer() {
    const iceServers = await inbox.iceServers();
    view.relay = iceServers.some((x) => [].concat(x.urls).some((u) => u.startsWith('turn')));
    pc = new RTCPeerConnection({ iceServers });
    for (const t of local.getTracks()) pc.addTrack(t, local);
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'ice', callId: s.callId, candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (remoteVideo.srcObject !== stream) remoteVideo.srcObject = stream;
      remoteVideo.play().catch(() => {});
      view.remoteReady = true; emit();
    };
    pc.onconnectionstatechange = () => {
      const st = pc && pc.connectionState;
      clearTimeout(lostTimer);
      if (st === 'connected') {
        dispatch({ type: 'connected' });
        send({ type: 'stand', callId: s.callId, inStand: view.inStand });   // so the other side knows from the start
      }
      else if (st === 'failed') dispatch({ type: 'failed' });
      else if (st === 'disconnected') lostTimer = setTimeout(() => dispatch({ type: 'failed' }), 10000); // may recover by itself
    };
  }

  async function startAsCaller() {
    await makePeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'offer', callId: s.callId, sdp: pc.localDescription.toJSON() });
  }

  async function onOffer(sdp) {
    await pc.setRemoteDescription(sdp);
    flushIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type: 'answer', callId: s.callId, sdp: pc.localDescription.toJSON() });
  }

  function cleanup() {
    clearTimeout(ringTimer); clearInterval(ringRepeat); clearTimeout(lostTimer);
    if (pc) { pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null; pc.close(); pc = null; }
    if (local) { local.getTracks().forEach((t) => t.stop()); local = null; }
    pendingIce = [];
    peerDevice = null;
    remoteVideo.srcObject = null;
    Object.assign(view, { startedAt: 0, muted: false, remoteInStand: false, remoteReady: false });
  }

  // In the stand the camera only sees the inside of the stand: send no video (a disabled track sends black).
  function applyStand() { if (local) local.getVideoTracks().forEach((t) => { t.enabled = !view.inStand; }); }
  function applyMute() { if (local) local.getAudioTracks().forEach((t) => { t.enabled = !view.muted; }); }

  // ---- the channel: joined while signed in, so a ring reaches an open Holo ----
  async function join() {
    await sb.realtime.setAuth();
    channel = sb.channel('holo-call', { config: { private: true, broadcast: { self: false } } })
      .on('broadcast', { event: 'call' }, ({ payload }) => { onMessage(payload).catch((e) => console.warn('call', e)); })
      .subscribe((status, err) => { if (err) console.warn('call channel', status, err); });
  }
  join();

  return {
    get state() { return { ...s, ...view, localStream: local }; },

    // Both must be called from a tap (camera/microphone prompt).
    async dial() {
      if (s.phase !== 'idle' && s.phase !== 'ended') return;
      await getMedia();
      peerDevice = null;
      dispatch({ type: 'dial', callId: crypto.randomUUID() });
      const ring = () => send({ type: 'ring', callId: s.callId, to: undefined });
      ring();
      ringRepeat = setInterval(ring, RING_REPEAT_MS);
      ringTimer = setTimeout(() => { send({ type: 'hangup', callId: s.callId, to: undefined }); dispatch({ type: 'timeout' }); }, RING_TIMEOUT_MS);
      inbox.notify({ action: 'call' }).catch(() => {});   // wakes a phone where Holo is closed
    },
    async answer() {
      if (s.phase !== 'incoming') return;
      await getMedia();
      dispatch({ type: 'answer' });
      await makePeer();                 // ready before the offer arrives
      send({ type: 'accept', callId: s.callId });
    },
    hangup() {
      if (s.phase === 'idle' || s.phase === 'ended') return;
      // Before the call connects, a hang-up goes to every device (they may all be ringing).
      const to = s.phase === 'outgoing' ? undefined : peerDevice || undefined;
      send({ type: s.phase === 'incoming' ? 'decline' : 'hangup', callId: s.callId, to });
      dispatch({ type: 'hangup' });
    },
    setMuted(m) { view.muted = m; applyMute(); emit(); },
    setInStand(inStand) {
      if (view.inStand === inStand) return;
      view.inStand = inStand; applyStand();
      if (s.callId && s.phase !== 'ended') send({ type: 'stand', callId: s.callId, inStand });
      emit();
    },
    destroy() { if (s.phase !== 'idle' && s.phase !== 'ended') this.hangup(); cleanup(); if (channel) sb.removeChannel(channel); channel = null; },
  };
}
