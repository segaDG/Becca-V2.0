/* BECCA Service Worker — PWA + Push Notification */

// ── Firebase Messaging (background push) ─────────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBgglo30BvAH6U0RrEjUukPCtW_GQiANIA',
  authDomain:        'becca-ae19d.firebaseapp.com',
  projectId:         'becca-ae19d',
  storageBucket:     'becca-ae19d.firebasestorage.app',
  messagingSenderId: '577597565371',
  appId:             '1:577597565371:web:8851035e30d5eed7407c9e',
});

const _messaging = firebase.messaging();

// Tampilkan notif saat app di background / tertutup
_messaging.onBackgroundMessage(payload => {
  const { title = 'BECCA', body = '' } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon:  '/img/logo-bps.png',
    badge: '/img/logo-bps.png',
    data:  payload.data || {},
    vibrate: [200, 100, 200],
  });
});

// Klik notif → buka/fokus ke tab BECCA
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});

// ── Static Cache ──────────────────────────────────────────
const CACHE_NAME = 'becca-static-v4';

const PRECACHE = [
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/tables.css',
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
  // Hanya cache request dari origin sendiri — skip semua external
  // (Firebase SDK punya fetch listener sendiri, bisa konflik jika tidak di-skip)
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }

  if (url.search.includes('v=') || url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|ico|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(res => {
          // Clone SEBELUM caches.open (sync) agar body belum dikonsumsi browser
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
  }
});
