const CACHE_NAME = 'Distance calculator';
const urlsToCache = [
  '/',
  '../src/routes/style.css',
  '../src/lib/index.js',
  '/ICON_192X192.png', // Remplacez par le chemin de votre icône
  // Ajoutez d'autres ressources à mettre en cache ici
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});