self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('family-fishing-cache-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/submit.html',
        '/winners.html',
        '/images/background.png',
        '/images/icon-192x192.png',
        '/images/icon-512x512.png',
        '/manifest.json',
        '/PDFs/rules.pdf',
        '/PDFs/PRIVACY-POLICY.pdf',
        '/pages/tackle.html'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Fallback to cached index.html for failed network requests
        return caches.match('/index.html');
      });
    })
  );
});
