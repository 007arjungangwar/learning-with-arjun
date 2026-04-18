const CACHE_NAME = 'learning-hub-v1';
const urlsToCache = [
    '/learning-with-arjun/',
    '/learning-with-arjun/index.html',
    '/learning-with-arjun/style.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});