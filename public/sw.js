// Hellfest Twin service worker: the app works without network on site.
// App shell: cache first. Weather (Open-Meteo): network first, cache as fallback. Fonts: cache first.
const VERSION = '__BUILD__';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-v1';
const FILES = ['./', './index.html', './assets/app.js', './assets/index.css', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('hors ligne');
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: name === SHELL });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.open-meteo.com') {
    e.respondWith(networkFirst(req));
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(cacheFirst(req, RUNTIME));
  } else if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    } else {
      e.respondWith(cacheFirst(req, SHELL));
    }
  }
});
