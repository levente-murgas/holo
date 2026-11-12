// Pure inbox helpers (no browser or Supabase dependencies) so Node can test them.

export const MAX_CLIP_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

// Storage path for an uploaded clip: "<user id>/<random id>.<ext>". The first folder must be the
// sender's id, which the storage RLS policy checks.
export function clipPath(userId, id, filename) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(filename || '');
  const ext = m ? m[1].toLowerCase() : 'mp4';
  return `${userId}/${id}.${ext}`;
}

// Merge incoming messages into a list: no duplicates (by id), newest first, later copies win.
export function mergeMessages(list, incoming) {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m });
  return [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id));
}

export function unseenCount(list, me) {
  return list.filter((m) => m.recipient === me && !m.seen_at).length;
}

// Who is "the other one": the member who isn't me (or me, if I'm the only member — handy for testing alone).
export function partnerOf(members, me) {
  return members.find((m) => m.user_id !== me) || members.find((m) => m.user_id === me) || null;
}

export function timeAgo(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago';
}
