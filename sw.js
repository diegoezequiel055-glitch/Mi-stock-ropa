// Service worker mínimo: no guarda nada en caché, solo existe para que el celular
// ofrezca "Instalar app". La app necesita conexión siempre (usa Firestore en vivo),
// así que cada pedido va directo a la red — y siempre revalida (no-cache), para que
// una app instalada no se quede mostrando una versión vieja de un archivo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request, { cache: 'no-cache' }));
});
