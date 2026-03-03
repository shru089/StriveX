// StriveX Service Worker v2.0
// Caches static assets for offline use; uses network-first for API calls
// Serves offline.html fallback when static pages can't be reached

const CACHE_NAME = 'strivex-v2';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/onboarding.html',
    '/offline.html',
    '/manifest.json',
    '/css/style.css',
    '/css/dashboard.css',
    '/css/onboarding.css',
    '/js/auth.js',
    '/js/dashboard.js',
    '/js/onboarding.js',
    '/js/utils.js',
    '/js/landing.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// ===== INSTALL: Pre-cache all static assets =====
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching static assets');
            return Promise.allSettled(
                STATIC_ASSETS.map((url) => cache.add(url).catch(() => null))
            );
        })
    );
    self.skipWaiting();
});

// ===== ACTIVATE: Clear old caches =====
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ===== FETCH: Smart caching strategy =====
// - API calls (/api/*)   -> Network-first (always fresh data, no stale tokens)
// - Navigation requests  -> Network-first, fallback to offline.html
// - Static assets        -> Cache-first, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Never cache cross-origin requests (analytics, fonts CDN handled separately)
    if (url.origin !== self.location.origin) {
        event.respondWith(fetch(request).catch(() => new Response('')));
        return;
    }

    // Network-first for API: always fresh, graceful fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() =>
                new Response(
                    JSON.stringify({ error: 'You appear to be offline. Please check your connection.' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                )
            )
        );
        return;
    }

    // Non-GET: always network
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // Navigation requests (page loads): network-first with offline.html fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache the fresh page
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() =>
                    caches.match(request).then(
                        (cached) => cached || caches.match(OFFLINE_URL)
                    )
                )
        );
        return;
    }

    // Cache-first for all other static assets (CSS, JS, images)
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
                return response;
            });
        })
    );
});

// ===== PUSH NOTIFICATIONS (future-ready) =====
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'StriveX', {
            body: data.body || 'You have a new update.',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'strivex-push',
            renotify: true,
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || '/')
    );
});
