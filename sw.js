const CACHE = 'alera-v10-in-app-update';
const CORE = [
  "./README.md",
  "./app.js",
  "./assets/brand/logo-horizontal.png",
  "./assets/brand/logo-mark.png",
  "./assets/brand/splash-loading.png",
  "./assets/brand/splash-welcome.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/icons/alera-maskable.svg",
  "./assets/icons/tiles/conditionals.svg",
  "./assets/icons/tiles/environment.svg",
  "./assets/icons/tiles/grammar.svg",
  "./assets/icons/tiles/practice.svg",
  "./assets/icons/tiles/reading.svg",
  "./assets/icons/tiles/reported-speech.svg",
  "./assets/icons/tiles/speaking.svg",
  "./assets/icons/tiles/vocabulary.svg",
  "./assets/icons/tiles/writing.svg",
  "./assets/icons/ui/alera-logo-mark.svg",
  "./assets/icons/ui/attention-dots.svg",
  "./assets/icons/ui/calendar.svg",
  "./assets/icons/ui/chevron-down.svg",
  "./assets/icons/ui/chevron-left.svg",
  "./assets/icons/ui/chevron-right.svg",
  "./assets/icons/ui/clock.svg",
  "./assets/icons/ui/comprehension-headphones.svg",
  "./assets/icons/ui/conditionals-nodes.svg",
  "./assets/icons/ui/confidence-star.svg",
  "./assets/icons/ui/decorative-leaves.svg",
  "./assets/icons/ui/environment-sprout.svg",
  "./assets/icons/ui/fluency-wave.svg",
  "./assets/icons/ui/grammar-document.svg",
  "./assets/icons/ui/home.svg",
  "./assets/icons/ui/info.svg",
  "./assets/icons/ui/more-leaf.svg",
  "./assets/icons/ui/overflow.svg",
  "./assets/icons/ui/practice-bars.svg",
  "./assets/icons/ui/practice-use.svg",
  "./assets/icons/ui/profile.svg",
  "./assets/icons/ui/progress-bars.svg",
  "./assets/icons/ui/pronunciation-sound.svg",
  "./assets/icons/ui/reading-book.svg",
  "./assets/icons/ui/reviews.svg",
  "./assets/icons/ui/search.svg",
  "./assets/icons/ui/settings.svg",
  "./assets/icons/ui/speaking-mic.svg",
  "./assets/icons/ui/speech-bubble.svg",
  "./assets/icons/ui/status-check.svg",
  "./assets/icons/ui/trend-line.svg",
  "./assets/icons/ui/vocabulary-book.svg",
  "./assets/icons/ui/writing-pencil.svg",
  "./data.js",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css"
];

// Reload the app shell from the network when available; keep offline fallback.
const APP_SHELL = new Set(['index.html','app.js','data.js','styles.css','manifest.webmanifest']);
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('alera-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET')return;
  const url = new URL(e.request.url);
  if(url.origin !== self.location.origin)return;
  const isShell = e.request.mode === 'navigate' || APP_SHELL.has(url.pathname.split('/').pop());
  const fetchAndRemember = () => fetch(e.request, {cache:'no-store'}).then(res => {
    if(res.ok){
      const copy=res.clone();
      e.waitUntil(caches.open(CACHE).then(c => c.put(e.request,copy)));
    }
    return res;
  });
  const offline = async () =>
    await caches.match(e.request) ||
    (e.request.mode === 'navigate' ? await caches.match('./index.html') : null) ||
    Response.error();
  e.respondWith(isShell
    ? fetchAndRemember().catch(offline)
    : caches.match(e.request).then(hit => hit || fetchAndRemember().catch(offline)));
});
