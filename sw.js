// ── BOLSILLO · service worker ────────────────────────────────────────────────
// Cambia VERSION cada vez que publiques cambios: el navegador descargará todo.
const VERSION = '5.3.0';
const CACHE = `bolsillo-${VERSION}`;
const APP_FILES = ['./', './index.html', './styles.css', './core.js', './ui.js', './forms.js', './sync.js', './manifest.json', './icon.png'];
// SDK de Firebase: URLs versionadas (inmutables). Se guardan para poder abrir
// la app sin conexión.
const SDK = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', e => {
  // Cada archivo por separado: si uno falla (p. ej. el ícono) no se cae toda la instalación.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(APP_FILES.map(f => c.add(f).catch(() => null)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos de la app (mismo origen): red primero, caché como respaldo.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
    return;
  }
  // SDK de Firebase: caché primero (no cambia para una misma versión).
  if (req.url.startsWith(SDK)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // Todo lo demás (Firestore, autenticación, indicadores): directo a la red, sin interceptar.
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
