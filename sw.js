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
  const options = {
    body: body || '',
    icon: '/img/logo-bps.png',
    badge: '/img/logo-bps.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [{ action: 'open', title: 'Buka' }],
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cl => {
    const win = cl.find(c => c.visibilityState === 'visible');
    if (win) return win.focus();
    return clients.openWindow('/');
  }));
});

// ── Static Cache — v5 (improved precache + strategy) ─────
const CACHE_NAME = 'becca-static-v98';

const PRECACHE = [
  '/',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/tables.css',
  '/img/logo-bps.png',
  // Core JS only — minimal for first paint
  '/js/utils.js',
  '/js/db.js',
  '/js/auth.js',
  '/js/ui/notify.js',
  '/js/ui/modal.js',
  '/js/ui/sidebar.js',
  '/js/app.js',
  // Non-critical: loaded via stale-while-revalidate, not precache
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

  // HTML navigation — network first, fallback to cached index
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // JS/CSS with version param — cache first (versioned = immutable)
  if (url.search.includes('v=')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Other static assets — stale-while-revalidate
  if (url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|ico|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Supabase API — network only (no cache for data)
});
