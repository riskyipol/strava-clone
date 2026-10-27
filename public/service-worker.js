const CACHE_NAME = 'strava-v1';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/tracker.js',
    './js/sync.js',
    './js/main.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) return response;
                return fetch(event.request);
            })
    );
});

// Sync event
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-activity') {
        event.waitUntil(syncAll());
    }
});

async function syncAll() {
    // Placeholder for background sync logic
    console.log('Background sync triggered');
}