/* QueueZeroTwo service worker. Bump V on each release to refresh the cache. Profiles are included in the app shell. */
const V = 'queuezerotwo-v4';
const SHELL = ['/', '/manifest.webmanifest', '/tailwind.css', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Oswald:wght@500;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(SHELL);
    // Best effort: a failed CDN fetch must not block the install.
    await Promise.all(CDN.map(u => {
      const r = new Request(u, { mode: 'no-cors' });
      return fetch(r).then(res => c.put(r, res)).catch(() => {});
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') return;
  // Live data and realtime are never cached.
  if (u.hostname.endsWith('supabase.co')) return;

  // App page: network first so a new deploy shows up right away, cache when offline.
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put('/', cp)); }
        return res;
      }).catch(() => caches.match('/', { ignoreSearch: true }))
    );
    return;
  }

  // Everything else: cached copy first, refreshed in the background.
  e.respondWith(
    caches.match(r, { ignoreVary: true }).then(hit => {
      const net = fetch(r).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

// The page asks for activation when the person taps Reload on the update notice.
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
