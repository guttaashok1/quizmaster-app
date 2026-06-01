/**
 * Interview Coach — Service Worker
 * Strategy:
 *   /api/*      → network only (never cache live API responses)
 *   *.html      → network only (always fresh — HTML must never be stale)
 *   everything else → cache-first with background revalidation
 */

const CACHE = 'ic-v5'; // bump version → clears all previous caches on activate

// Pre-cache static shell assets ONLY — never HTML pages
// HTML is intentionally excluded so pages always load fresh from the server.
const PRECACHE = [
  '/styles.css',
  '/auth.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg',
];

// ── Install: pre-cache static shell ────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// ── Activate: purge ALL previous caches ─────────────────────────────────────
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

  // 1. Non-GET or cross-origin → pass through unchanged
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 2. API routes → network only (never cache dynamic data)
  if (url.pathname.startsWith('/api/')) return;

  // 3. HTML pages → always fetch fresh, bypassing both SW cache AND browser HTTP cache.
  //    Uses cache:'no-store' so the browser never reads a stale cached copy.
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(fetch(new Request(request.url, { cache: 'no-store' })));
    return;
  }

  // 4. Static assets (CSS, JS, images, fonts) → cache-first + background revalidate
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Serve cached copy immediately; refresh in background (stale-while-revalidate)
        fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res));
        }).catch(() => {});
        return cached;
      }
      // Not in cache yet — fetch, cache, and return
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
