// ── VERSIÓN: cambia este número cada vez que subas cambios ──────────────────
// El navegador detecta que el número cambió y descarga todo de nuevo
const VERSION = '2.0.0';
const CACHE = `presupuesto-${VERSION}`;
const FILES = ['./index.html', './manifest.json', './icon.png'];

// ── INSTALL: cachear archivos de la nueva versión ────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES))
  );
  // Activar inmediatamente sin esperar a que el usuario cierre la app
  self.skipWaiting();
});

// ── ACTIVATE: borrar cachés viejos y tomar control al instante ───────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)  // borrar todas las versiones anteriores
          .map(k => caches.delete(k))
      )
    )
  );
  // Tomar control de todas las pestañas abiertas inmediatamente
  self.clients.claim();
});

// ── FETCH: estrategia "Network First con fallback a caché" ───────────────────
// Siempre intenta la red primero para tener la versión más reciente
// Si no hay red, usa la caché (modo offline)
self.addEventListener('fetch', e => {
  // Solo manejar peticiones GET
  if (e.request.method !== 'GET') return;

  // Para los archivos de la app: Network First
  const isAppFile = FILES.some(f => e.request.url.includes(f.replace('./','')));

  if (isAppFile) {
    e.respondWith(
      fetch(e.request)
        .then(networkResponse => {
          // Actualizar el caché con la versión más reciente
          const clone = networkResponse.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return networkResponse;
        })
        .catch(() => {
          // Sin red: usar caché
          return caches.match(e.request);
        })
    );
  } else {
    // Para otros recursos (fuentes, APIs): Cache First
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).catch(() => caches.match('./index.html'));
      })
    );
  }
});

// ── MENSAJES DESDE LA APP ────────────────────────────────────────────────────
self.addEventListener('message', e => {
  // La app pide activar la nueva versión inmediatamente
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // La app pregunta qué versión está corriendo
  if (e.data === 'CHECK_UPDATE') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SW_VERSION', version: VERSION });
      });
    });
  }
});
