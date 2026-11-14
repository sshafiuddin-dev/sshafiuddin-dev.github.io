// Offline support for Iqama Times. Network first, so a new deploy or new iqama times show at once;
// the cached copy is used only when the network fails.
const CACHE = 'iqama-v26';
const SHELL = ['./', 'boot.js', 'daisy.css', 'styles.css', 'look.css', 'app.js', 'logic.js', 'sky.js', 'clocks.js', 'weather.js', 'adhkar.js', 'hisn.js', 'quran.js', 'quran-logic.js', 'motion.js', '../vendor/motion.min.js', 'lib/PrayTimes.js', 'lib/CalculationMethods.js', 'iqama.json', 'hisn-text.json', 'manifest.webmanifest', 'icon-192.png', 'icons/favicon.svg', 'favicon-32.png', 'apple-touch-icon.png',
  // the guide's pages (Cloudflare serves them without .html), so Help opens offline; its screenshots are cached as they are viewed
  'guide/', 'guide/guide.css', 'guide/guide.js', ...['setup', 'location', 'today', 'iqama', 'alerts', 'display', 'quran', 'adhkar', 'weather', 'help'].map(p => `guide/${p}`)];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // shortcut: adhan audio is left to the browser's own cache (it is fetched in ranges), so it may not play offline
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('.mp3')) return;
  e.respondWith(caches.open(CACHE).then(cache =>
    fetch(e.request).then(r => { if (r.status === 200) cache.put(e.request, r.clone()); return r; })
      .catch(() => cache.match(e.request, { ignoreSearch: true }).then(hit => hit || Response.error()))));
});
