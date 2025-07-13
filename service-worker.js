const CACHE_NAME = 'timezone-explorer-cache-v1';
const urlsToCache = [
    '/timezone-explorer/', // Root of the app within the repo
    '/timezone-explorer/index.html',
    '/timezone-explorer/css/style.css',
    '/timezone-explorer/css/settings.css',
    '/timezone-explorer/js/script.js'
    // Add other assets like images, fonts if any - ensure they are local and accessible
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // The 'addAll' method will fail if any single request fails.
                // Ensure all URLs listed here are correct and accessible.
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to add all URLs to cache during install:', error);
                // Propagate the error so the service worker fails to install
                return Promise.reject(error);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
