// Service worker : le site fonctionne hors ligne (réseau d'abord, cache en secours).
const CACHE = 'marque-points-v4';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/base.css',
  'assets/js/theme.js',
  'assets/img/icon.svg',
  'skull-king/',
  'skull-king/index.html',
  'skull-king/sk.css',
  'skull-king/app.js',
  'skull-king/rules.js',
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
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
