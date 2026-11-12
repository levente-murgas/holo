// Service worker: lets the page install as an app and still open when offline.
// Strategy: network first for our own files (so every deploy shows up right away),
// falling back to the last cached copy when there is no connection. Supabase and CDN
// requests are left alone. It also shows push notifications (sent by supabase/functions/notify).

const CACHE = 'holo-v1';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/main.js', 'js/settings.js', 'js/processing.js', 'js/sources.js', 'js/layout.js', 'js/ui.js',
  'js/config.js', 'js/inbox.js', 'js/inbox-logic.js', 'js/inbox-ui.js', 'js/pwa.js',
  'js/push.js', 'js/push-logic.js', 'js/settings-ui.js', 'js/surprise.js', 'js/surprise-logic.js', 'js/setup.js', 'js/setup-logic.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      throw err;
    }
  })());
});

// ---- push notifications ----
// Always show one: iPhone revokes push for apps that receive a push without showing anything.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Holo', {
    body: d.body || 'Something new arrived ♥',
    tag: d.tag || 'holo',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: self.registration.scope },
  }));
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
