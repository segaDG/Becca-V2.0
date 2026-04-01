/* ============================================
   BECCA V2.0 — Push Notification Module
   Firebase Cloud Messaging (FCM)
   Notif: task baru, reminder, broadcast, dept/jabatan
============================================ */
const PushModule = (() => {
  'use strict';

  const VAPID_KEY    = 'BO2AZgzwA5nJROSP6yUgaVdWjcVoSqTIfef4Bvem3oViRLI3C9ebDG5WYeSnv149RtlIZGhVyNd3N6xkRtfMju4';
  const SEND_URL     = 'https://pevwkyrsfpmzhwxkoask.supabase.co/functions/v1/send-push';
  const FB_CONFIG    = {
    apiKey:            'AIzaSyBgglo30BvAH6U0RrEjUukPCtW_GQiANIA',
    authDomain:        'becca-ae19d.firebaseapp.com',
    projectId:         'becca-ae19d',
    storageBucket:     'becca-ae19d.firebasestorage.app',
    messagingSenderId: '577597565371',
    appId:             '1:577597565371:web:8851035e30d5eed7407c9e',
  };

  let _messaging = null;
  let _ready     = false;

  // ── Load Firebase CDN script ────────────────────────────
  function _loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('Gagal load: ' + src));
      document.head.appendChild(s);
    });
  }

  // ── Init Firebase Messaging ─────────────────────────────
  async function init() {
    if (_ready) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    try {
      await _loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
      await _loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
      _messaging = firebase.messaging();
      _ready = true;

      // Notif saat app sedang buka (foreground)
      _messaging.onMessage(payload => {
        const { title, body } = payload.notification || {};
        if (typeof Notify !== 'undefined') Notify.info(`🔔 ${title}${body ? ': ' + body : ''}`);
      });

      console.log('[Push] Firebase Messaging ready ✓');
    } catch(e) {
      console.warn('[Push] Init error:', e.message);
    }
  }

  // ── Minta izin & daftarkan token ────────────────────────
  async function requestAndRegister(user) {
    if (!_ready) await init();
    if (!_messaging) return null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push] Izin notifikasi ditolak');
        return null;
      }
      // Gunakan SW yang sudah terdaftar (sw.js)
      const reg   = await navigator.serviceWorker.ready;
      const token = await _messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (!token) return null;

      // Simpan token ke Supabase push_tokens
      await DB.savePushToken({
        token,
        user_id:  user?.id       || null,
        username: user?.username  || null,
        nama:     user?.nama      || null,
        role:     user?.role      || null,
        divisi:   user?.divisi    || null,
        jabatan:  user?.jabatan   || null,
        device:   navigator.userAgent.substring(0, 200),
        last_seen: new Date().toISOString(),
      }).catch(() => {});

      localStorage.setItem('becca_push_token', token);
      console.log('[Push] Token terdaftar ✓');
      return token;
    } catch(e) {
      console.warn('[Push] Registrasi token gagal:', e.message);
      return null;
    }
  }

  // ── Kirim notif via Netlify Function ────────────────────
  async function _send({ tokens, title, body, data = {} }) {
    if (!tokens?.length) { console.warn('[Push] No tokens to send to'); return { error: 'No tokens' }; }
    console.log('[Push] Sending to', tokens.length, 'tokens:', title);
    // FCM V1 requires ALL data values to be strings
    const safeData = {};
    Object.entries(data).forEach(([k,v]) => { safeData[k] = String(v); });
    try {
      const res = await fetch(SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens, title, body, data: safeData }),
      });
      const result = await res.json();
      if (!res.ok) console.error('[Push] Server error:', res.status, result);
      else console.log('[Push] Sent OK:', result);
      return result;
    } catch(e) {
      console.error('[Push] Send gagal:', e.message);
      return { error: e.message };
    }
  }

  // ── Test: diagnosa + kirim ke diri sendiri ──────────────
  async function testPush() {
    console.log('=== PUSH NOTIFICATION DIAGNOSTIC ===');
    console.log('1. Notification API:', 'Notification' in window ? 'OK' : 'NOT AVAILABLE');
    console.log('2. ServiceWorker:', 'serviceWorker' in navigator ? 'OK' : 'NOT AVAILABLE');
    console.log('3. Permission:', typeof Notification !== 'undefined' ? Notification.permission : 'N/A');
    console.log('4. Firebase ready:', _ready);
    console.log('5. Messaging:', _messaging ? 'OK' : 'NULL');
    console.log('6. Stored token:', localStorage.getItem('becca_push_token') ? 'EXISTS' : 'EMPTY');

    // Coba register dulu jika belum ada token
    let token = localStorage.getItem('becca_push_token');
    if (!token) {
      console.log('\n→ Mencoba register token...');
      const user = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
      token = await requestAndRegister(user);
      if (!token) {
        console.error('→ GAGAL register token. Cek:');
        console.error('  - Apakah notification permission di-allow?');
        console.error('  - Apakah service worker terdaftar?');
        console.error('  - Coba klik icon gembok di address bar → izinkan notifikasi');
        return { error: 'Token registration failed' };
      }
    }

    console.log('\n→ Mengirim test notification...');
    const result = await _send({ tokens:[token], title:'BECCA Test', body:'Push notification berhasil! ' + new Date().toLocaleTimeString(), data:{test:'true'} });
    console.log('→ Result:', result);

    if (result?.failed > 0 && result?.errors?.length) {
      console.error('→ FCM rejected token(s):');
      result.errors.forEach(e => console.error('  Token:', e.token, '→', e.error));
      console.error('');
      console.error('Kemungkinan fix:');
      console.error('  - "NOT_FOUND" / "UNREGISTERED": Token expired → logout, clear cache, login ulang');
      console.error('  - "INVALID_ARGUMENT": VAPID key mismatch → cek Project Settings > Cloud Messaging');
      console.error('  - "SENDER_ID_MISMATCH": Firebase project berbeda antara client dan server');
    } else if (result?.error) {
      console.error('→ Server error:', result.error);
    }
    return result;
  }

  // ── Kirim ke user tertentu (by username/nama) ────────────
  async function sendToUser(username, { title, body, data }) {
    const rows = await DB.getPushTokens({ username }).catch(() => []);
    // Fallback: cari by nama jika username tidak ketemu
    const tokens = rows.length
      ? rows.map(r => r.token)
      : (await DB.getPushTokens({ nama: username }).catch(() => [])).map(r => r.token);
    await _send({ tokens, title, body, data });
  }

  // ── Broadcast ke semua user ─────────────────────────────
  async function broadcast(title, body, data = {}) {
    const rows   = await DB.getPushTokens({}).catch(() => []);
    const tokens = rows.map(r => r.token);
    await _send({ tokens, title, body, data });
  }

  // ── Kirim ke grup (divisi / jabatan / role) ─────────────
  async function sendToGroup(filter, { title, body, data }) {
    const rows   = await DB.getPushTokens(filter).catch(() => []);
    const tokens = rows.map(r => r.token);
    await _send({ tokens, title, body, data });
  }

  // ── Kirim task reminder (dipanggil dari cron/scheduler) ──
  async function sendTaskReminder(task) {
    const assignees = (() => {
      try { return JSON.parse(task.assignees || '[]'); } catch { return []; }
    })();
    if (task.assignee) assignees.push(task.assignee);
    for (const name of assignees) {
      await sendToUser(name, {
        title: '⏰ Pengingat Task',
        body:  `"${task.judul || task.title}" deadline hari ini`,
        data:  { taskId: task.id, type: 'reminder' },
      });
    }
  }

  return { init, requestAndRegister, sendToUser, broadcast, sendToGroup, sendTaskReminder, testPush };
})();

window.PushModule = PushModule;
