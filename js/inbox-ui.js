// Inbox panel: sign-in, send button, list of messages. Playing a message switches the page to it.

import { S, save } from './settings.js';
import { sync, hidePanel, showPanel } from './ui.js';
import { video, videoState, loadVideoFile } from './sources.js';
import { isSurprise } from './surprise-logic.js';
import { askOrientationPermission, startSurprise } from './surprise.js';
import { isConfigured, createInbox } from './inbox.js';
import { timeAgo } from './inbox-logic.js';
import { isInstalled } from './pwa.js';
import { initSettings, onInboxState } from './settings-ui.js';

const $ = (s) => document.querySelector(s);

let inbox = null, st = null;

function setStatus(t) { $('#inboxStatus').textContent = t || ''; }

function sendLabel() {
  if (!st || !st.partner) return 'Send';
  const to = st.partner.name;
  if (S.mode === 'video') return videoState.file ? 'Send this video to ' + to : 'Pick a video to send';
  if (S.mode === 'message') return 'Send this message to ' + to;
  return 'Switch to Video or Message to send';
}

export function refreshSendButton() {
  const b = $('#send'); if (!b) return;
  b.textContent = sendLabel();
  b.disabled = !st || !st.partner || !((S.mode === 'video' && videoState.file) || (S.mode === 'message' && S.msg));
}

function nameOf(id) {
  const m = st.members.find((x) => x.user_id === id);
  return m ? m.name : '?';
}

function render() {
  const signedIn = !!(st && st.user);
  $('#authBox').hidden = signedIn;
  $('#inboxBox').hidden = !signedIn;
  $('#inboxBadge').textContent = st && st.unseen ? st.unseen + ' new' : '';
  if (!st) return;
  if (st.error) setStatus(st.error);
  if (!signedIn) return;
  if (st.notMember) { $('#who').textContent = 'Signed in as ' + st.user.email + ', but this account is not on the members list.'; return; }
  $('#who').textContent = 'Signed in as ' + (st.me ? st.me.name : st.user.email);
  refreshSendButton();

  const ul = $('#msgs'); ul.textContent = '';
  if (!st.messages.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No messages yet.'; ul.append(li); }
  for (const m of st.messages) {
    const mine = m.sender === st.user.id && m.recipient !== st.user.id;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'msg' + (!mine && !m.seen_at ? ' unseen' : '');
    const kind = m.clip_path ? '🎬 Video' : '♥ Message';
    const head = document.createElement('span'); head.className = 'msg-head';
    head.textContent = (mine ? 'To ' + nameOf(m.recipient) : 'From ' + nameOf(m.sender)) + ' · ' + timeAgo(m.created_at);
    const body = document.createElement('span'); body.className = 'msg-body';
    body.textContent = kind + (m.text ? ' · “' + m.text + '”' : '');
    btn.append(head, body);
    btn.addEventListener('click', () => play(m));
    li.append(btn); ul.append(li);
  }
}

// Settings → "Try it": open the newest message (yours included) as a surprise. For testing.
export function tryLatestAsSurprise() {
  const list = (st && st.messages) || [];
  const m = list.find((x) => x.clip_path) || list[0];   // newest clip, else newest message
  if (!m) return 'No messages yet: send one first.';
  $('#settings').hidden = true;
  play(m, { forceSurprise: true });
  return '';
}

async function play(m, { forceSurprise = false } = {}) {
  const surprise = forceSurprise || isSurprise(S.surprise, m, st.user.id);
  // Must run inside the tap, before any await (iPhone only shows the motion prompt for a tap).
  const permission = surprise ? askOrientationPermission() : null;
  try {
    setStatus(m.clip_path ? 'Downloading…' : '');
    const blob = await inbox.open(m);
    if (blob) {
      S.mode = 'video'; S.src = m.src; S.view = m.view; save(); sync();
      const ext = m.clip_path.split('.').pop();
      loadVideoFile(new File([blob], 'clip.' + ext, { type: blob.type || 'video/mp4' }), {
        muted: !S.sound, autoplay: !surprise, onStatus: (t) => { $('#status').textContent = t; },
      });
      setStatus('');
    } else {
      S.mode = 'message'; S.msg = m.text || ''; save(); sync();
    }
    if (surprise) {
      hidePanel();
      startSurprise({
        from: nameOf(m.sender), permission,
        onReveal: () => { if (blob) playFromStart(); },
        onCancel: () => { video.pause(); S.mode = 'test'; save(); sync(); showPanel(); },
      });
    }
  } catch (e) { setStatus('Could not open: ' + (e.message || e)); }
}

// Revealing can happen seconds after the last tap, when the browser may refuse sound: fall back to muted.
function playFromStart() {
  video.currentTime = 0;
  video.muted = !S.sound;
  video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
}

export async function initInbox() {
  if (!isConfigured()) {
    $('#authBox').hidden = true;
    setStatus('Sending is not set up yet: fill in js/config.js (see SETUP.md).');
    initSettings(null);
    return;
  }
  try {
    inbox = await createInbox((s) => { st = s; render(); onInboxState(s); });
  } catch (e) { setStatus('Could not load Supabase: ' + (e.message || e)); initSettings(null); return; }
  initSettings(inbox);

  $('#signin').addEventListener('click', async () => {
    const email = $('#email').value.trim(); if (!email) return;
    try {
      await inbox.signIn(email);
      $('#codeBox').hidden = false;
      setStatus(isInstalled()
        ? 'Check your email and type the code here (the link would open the browser, not this app).'
        : 'Check your email: tap the link, or type the code here.');
    } catch (e) { setStatus('Sign-in failed: ' + (e.message || e)); }
  });
  $('#verify').addEventListener('click', async () => {
    const email = $('#email').value.trim(), code = $('#code').value.replace(/\s/g, '');
    if (!email || !code) return;
    try { await inbox.verifyCode(email, code); setStatus(''); $('#code').value = ''; $('#codeBox').hidden = true; }
    catch (e) { setStatus('Code not accepted: ' + (e.message || e) + '. Use the newest email, within an hour.'); }
  });
  $('#send').addEventListener('click', async () => {
    const b = $('#send'); b.disabled = true;
    try {
      if (S.mode === 'video') {
        setStatus('Uploading…');
        await inbox.send({ file: videoState.file, src: S.src, view: S.view });
      } else {
        await inbox.send({ text: S.msg });
      }
      setStatus('Sent ♥');
    } catch (e) { setStatus('Send failed: ' + (e.message || e)); }
    refreshSendButton();
  });
}
