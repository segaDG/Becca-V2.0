/* BECCA Service Worker — PWA support */
const CACHE_NAME = 'becca-static-v1';

// Aset statis yang di-cache saat install
const PRECACHE = [
  '/',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/tables.css',
  '/img/icon.svg',
];

// ---- Install: pre-cache aset utama ----
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: hapus cache lama ----
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ---- Fetch strategy ----
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Selalu ke network: Supabase API, CDN eksternal, non-GET
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('jsdelivr.net')) return;
  if (url.hostname.includes('fonts.')) return;

  // Navigate (HTML): network-first, fallback ke cached '/'
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
    return;
  }

  // JS/CSS/img dengan ?v= (versioned): cache-first, update di background
  if (url.search.includes('v=') || url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|ico|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
  }
});
