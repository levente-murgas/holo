// Service worker: lets the page install as an app and still open when offline.
// Strategy: network first for our own files (so every deploy shows up right away),
// falling back to the last cached copy when there is no connection. Supabase and CDN
// requests are left alone. It also shows push notifications (sent by supabase/functions/notify).

// __BUILD__ is replaced with the commit id at build time (vite.config.js), so every
// deploy changes this file and phones pick up the new version (js/pwa.js reloads once it takes over).
const BUILD = '__BUILD__';
const CACHE = 'holo-' + BUILD;
// The placeholder is replaced with the built files (vite.config.js): their names change with every build.
const SHELL = ['__SHELL__'];

self.addEventListener('install', (e) => {
  // In development (npm run dev) the list is still the placeholder: cache nothing up front.
  const shell = SHELL.filter((f) => f !== '__SHELL__');
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      // no-cache: revalidate with GitHub Pages (cheap 304) instead of trusting its 10-minute HTTP cache
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true });   // the built page asks for its files with crossorigin, which some servers answer with Vary: Origin
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html', { ignoreSearch: true });
      throw err;
    }
  })());
});

// ---- push notifications ----
// Always show one: iPhone revokes push for apps that receive a push without showing anything.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const tag = d.tag || 'holo';
  e.waitUntil((async () => {
    // Each call has its own tag (so it rings even if an older one is still listed); clear the old ones.
    if (tag.startsWith('holo-call')) {
      const old = await self.registration.getNotifications().catch(() => []);
      old.filter((n) => n.tag.startsWith('holo-call')).forEach((n) => n.close());
    }
    await self.registration.showNotification(d.title || 'Holo', {
      body: d.body || 'Something new arrived',
      tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: self.registration.scope },
    });
  })());
});

// Tapping the notification brings Holo to the front (or opens it); the inbox catches up on open.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((c) => c.url.startsWith(self.registration.scope));
    if (w) return w.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  })());
});
