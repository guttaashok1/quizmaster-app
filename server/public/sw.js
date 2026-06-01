/**
 * Interview Coach — Service Worker
 * Strategy:
 *   /api/*      → network only (never cache live API responses)
 *   *.html      → network-first (always try fresh, cache as fallback)
 *   everything else → cache-first, refresh cache in background
 */

const CACHE = 'ic-v3'; // bump to force-clear stale PWA cache

// Assets to pre-cache on install (shell)
const PRECACHE = [
  '/interview/',
  '/styles.css',
  '/auth.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
];

// ── Install: pre-cache shell ────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  // Activate immediately — don't wait for old tab to close
  self.skipWaiting();
});

// ── Activate: purge stale caches ────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // 1. Non-GET or different origin → pass through unchanged
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 2. API routes → network only (no caching)
  if (url.pathname.startsWith('/api/')) return;

  // 3. HTML pages → network-first (show fresh content; fall back to cache if offline)
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          // Cache a fresh copy as we go
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 4. Static assets (CSS, JS, images, fonts) → cache-first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Refresh cache in background (stale-while-revalidate)
        fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res));
        }).catch(() => {});
        return cached;
      }
      // Not in cache — fetch and cache
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
