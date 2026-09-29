// Siren Siege service worker: makes the game installable and playable offline.
// - Pages (navigations): network first, so a new deploy shows up right away;
//   the cached copy is only used offline.
// - Everything else from this origin (hashed JS/CSS, art, fonts, icons): served
//   from cache and refreshed in the background (stale-while-revalidate).
const CACHE = 'siren-siege-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate' || req.cache === 'no-store') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && req.mode === 'navigate') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./'))),
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res.ok && res.type === 'basic') c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    ),
  );
});
