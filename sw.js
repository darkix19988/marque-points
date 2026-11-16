// Service worker : le site fonctionne hors ligne (réseau d'abord, cache en secours).
const CACHE = 'marque-points-v6';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/base.css',
  'assets/js/theme.js',
  'assets/js/update.js',
  'assets/css/app.css',
  'assets/img/icon.svg',
  'skull-king/',
  'skull-king/index.html',
  'skull-king/app.js',
  'skull-king/rules.js',
  'depenses/',
  'depenses/index.html',
  'depenses/dep.css',
  'depenses/app.js',
  'depenses/money.js',
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
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // toujours la version en ligne, jamais en cache
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
