// ── Firebase Cloud Messaging (Push Notifications) ────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBhL-Y4jUxQzmHiCbSR6WWwjMcMtQK6ZmQ",
  authDomain:        "beccaorderapp.firebaseapp.com",
  projectId:         "beccaorderapp",
  storageBucket:     "beccaorderapp.firebasestorage.app",
  messagingSenderId: "405498528940",
  appId:             "1:405498528940:web:9ab5f92f7b28fd01cdcb8e"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  if (!title) return;
  return self.registration.showNotification(title, {
    body: body || '',
    icon: '/img/logo-bps.png',
    badge: '/img/logo-bps.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [{ action: 'open', title: 'Buka' }],
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cl => {
    const win = cl.find(c => c.visibilityState === 'visible');
    if (win) return win.focus();
    return clients.openWindow('/');
  }));
});

// ── Cache Strategy ─────────────────────────────────────────
// STALE-WHILE-REVALIDATE for versioned assets (?v=BUILD_VERSION):
//   Serve cached version instan, fetch fresh di background.
//   URL ber-versi → kalau BUILD_VERSION bump, URL beda → cache miss → fetch baru.
//   Repeat visit load ~70% lebih cepat tanpa risk serve stale code (URL diff).
// NETWORK-FIRST for non-versioned JS/CSS (eager scripts di <head> tanpa ?v=) —
//   tetap fetch fresh tiap visit, fallback cache offline. Safety net.
// Cache static assets (images, fonts) tetap stale-while-revalidate.
// BUMP CACHE_NAME tiap kali strategy ini berubah supaya old cache di-clear.
const CACHE_NAME = 'becca-v130';

// Only precache truly static assets (images, fonts) — NOT JS/CSS
const PRECACHE = [
  '/img/logo-bps.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // HTML navigation — network first, fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Versioned JS/CSS (?v=BUILD_VERSION) — STALE-WHILE-REVALIDATE.
  // Aman karena URL ber-versi: kalau code update, BUILD_VERSION bump → URL beda
  // → cache miss → fetch fresh. Cache hanya serve untuk URL yg sama (versi sama
  // = code sama). Repeat visit instan.
  const hasVersion = url.search.includes('v=');
  if (hasVersion && url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        // Return cached jika ada, network di background. Kalau cache miss, tunggu network.
        return cached || networkFetch;
      })
    );
    return;
  }

  // Non-versioned JS/CSS — tetap NETWORK FIRST (eager scripts di <head>).
  // Tidak bisa pakai stale-while-revalidate karena URL sama walau code update.
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Images, fonts — stale-while-revalidate (fast load, update in background)
  if (url.pathname.match(/\.(svg|png|jpg|jpeg|ico|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) { const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, clone)); }
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Supabase API & everything else — network only
});
