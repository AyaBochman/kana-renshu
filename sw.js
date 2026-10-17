// Service worker: makes the app work offline and installable.
// Bump VERSION (and APP_VERSION in src/app.js) whenever you change any file listed in ASSETS,
// so installed copies pick up the update.
const VERSION = '1.2.0';
const CACHE = `kana-renshu-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/styles.css',
  'src/main.js',
  'src/app.js',
  'src/today.js',
  'src/session.js',
  'src/words.js',
  'src/progress.js',
  'src/settings.js',
  'src/scenes.js',
  'src/icons.js',
  'src/audio.js',
  'src/kana.js',
  'src/romaji.js',
  'src/srs.js',
  'src/decks.js',
  'src/storage.js',
  'data/hiragana.json',
  'data/katakana.json',
  'fonts/KleeOne-SemiBold.woff2',
  'fonts/ZenKakuGothicNew-Regular.woff2',
  'fonts/ZenKakuGothicNew-Medium.woff2',
  'fonts/ZenKakuGothicNew-Bold.woff2',
  'fonts/ShipporiMincho-Medium.woff2',
  'fonts/ZenMaruGothic-Medium.woff2',
  'fonts/DMMono-Regular.woff2',
  'fonts/DMMono-Medium.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

// On localhost, always try the network first so edits show up on reload.
const DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

// Fetch every file fresh from the server (not the browser's HTTP cache), so a new version never
// stores stale copies of files that didn't change their name.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error('offline and not cached');
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(DEV ? networkFirst(request) : caches.match('index.html').then(r => r || fetch(request)));
    return;
  }
  event.respondWith(DEV ? networkFirst(request) : cacheFirst(request));
});
