// Supabase backend: sign-in, sending clips/messages, receiving them live and catching up on open.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { clipPath, mergeMessages, unseenCount, partnerOf, MAX_CLIP_BYTES } from './inbox-logic.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const BUCKET = 'clips';

export const isConfigured = () => !!(SUPABASE_URL && SUPABASE_KEY);

// Sign-in error carried back in the redirect URL (hash or query), or ''.
function authErrorFromUrl(loc) {
  for (const part of [loc.hash.slice(1), loc.search.slice(1)]) {
    const p = new URLSearchParams(part);
    if (p.get('error') || p.get('error_code')) {
      const msg = (p.get('error_description') || p.get('error_code') || p.get('error')).replace(/\+/g, ' ');
      return 'Sign-in link failed: ' + msg + '. Request a new link and open it once.';
    }
  }
  return '';
}

// onChange(state) is called whenever anything visible changes.
// state: { user, me, partner, members, messages, unseen, error, notMember }
export async function createInbox(onChange) {
  // A failed sign-in link (expired, already used, wrong redirect) comes back as
  // #error=...&error_description=... ; supabase-js ignores it silently, so show it.
  const linkError = authErrorFromUrl(location);
  if (linkError) history.replaceState(null, '', location.pathname);

  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const state = { user: null, me: null, partner: null, members: [], messages: [], unseen: 0, error: linkError, notMember: false };
  let channel = null;

  const emit = () => { state.unseen = unseenCount(state.messages, state.user && state.user.id); onChange({ ...state }); };
  const fail = (e) => { state.error = (e && e.message) || String(e); emit(); };

  function addMessages(rows) { state.messages = mergeMessages(state.messages, rows); emit(); }

  async function start(user) {
    state.user = user; state.error = ''; state.notMember = false;
    const { data: members, error } = await sb.from('members').select('user_id, name');
    if (error) return fail(error);
    state.members = members;
    state.me = members.find((m) => m.user_id === user.id) || null;
    if (!state.me) { state.notMember = true; return emit(); }
    state.partner = partnerOf(members, user.id);

    // Subscribe first, then fetch: anything that arrives in between is caught by one or the
    // other, and mergeMessages drops the duplicate.
    channel = sb.channel('inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'recipient=eq.' + user.id },
        (p) => addMessages([p.new]))
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        const { data, error: e } = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
        if (e) return fail(e);
        addMessages(data);
      });
    emit();
  }

  function stop() {
    if (channel) { sb.removeChannel(channel); channel = null; }
    Object.assign(state, { user: null, me: null, partner: null, members: [], messages: [], notMember: false });
    emit();
  }

  sb.auth.onAuthStateChange((event, session) => {
    const user = session && session.user;
    // run outside the auth callback (supabase-js recommends not awaiting other calls inside it)
    setTimeout(() => {
      if (user && (!state.user || state.user.id !== user.id)) start(user);
      else if (!user && state.user) stop();
      else if (!user) emit();
    }, 0);
  });

  return {
    async signIn(email) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
    },
    // Sign in with the code from the same email. Needed in the installed app on iPhone: a tapped
    // link opens Safari, which has its own storage, so the session would land there, not in the app.
    async verifyCode(email, token) {
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw error;
    },
    async signOut() { await sb.auth.signOut(); },

    // Send a clip (file + how to show it) and/or a text to the partner.
    async send({ file, text, src = 'rec', view = 'bottom' }) {
      if (!state.me || !state.partner) throw new Error('Not signed in');
      let path = null;
      if (file) {
        if (file.size > MAX_CLIP_BYTES) throw new Error('Clip is over 50 MB. Trim it or record a shorter one.');
        path = clipPath(state.user.id, crypto.randomUUID(), file.name);
        const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'video/mp4' });
        if (error) throw error;
      }
      const { data, error } = await sb.from('messages')
        .insert({ recipient: state.partner.user_id, clip_path: path, text: text || null, src, view })
        .select().single();
      if (error) {
        if (path) await sb.storage.from(BUCKET).remove([path]); // don't leave an orphaned clip
        throw error;
      }
      addMessages([data]);
      return data;
    },

    // Download a message's clip (Blob, or null for text-only) and mark it seen if it was for me.
    async open(msg) {
      let blob = null;
      if (msg.clip_path) {
        const { data, error } = await sb.storage.from(BUCKET).download(msg.clip_path);
        if (error) throw error;
        blob = data;
      }
      if (msg.recipient === state.user.id && !msg.seen_at) {
        const seen_at = new Date().toISOString();
        const { error } = await sb.from('messages').update({ seen_at }).eq('id', msg.id);
        if (!error) addMessages([{ id: msg.id, seen_at }]);
      }
      return blob;
    },
  };
}
