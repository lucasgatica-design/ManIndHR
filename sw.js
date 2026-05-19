// Service Worker — TALLER.APP
// Guarda los archivos en caché para funcionar sin internet

const CACHE_NAME = 'tallerapp-v1';

// Archivos que se guardan la primera vez que se abre la app
const ARCHIVOS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './data.json',
  './manifest.json'
];

// Instalación: guarda todos los archivos en caché
self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ARCHIVOS))
  );
});

// Activación: limpia cachés viejos si actualizaste la app
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
});

// Fetch: sirve desde caché si no hay internet
self.addEventListener('fetch', evento => {
  evento.respondWith(
    caches.match(evento.request).then(cached => {
      return cached || fetch(evento.request);
    })
  );
});
