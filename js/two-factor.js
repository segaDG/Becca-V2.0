/* ============================================
   BECCA V2.0 — Two-Factor Authentication (2FA)
   OTP 6-digit via Email (EmailJS) / WhatsApp (Fonnte).
   Trust device 7 hari, backup codes recovery.
============================================ */
const TwoFA = (() => {
  'use strict';

  const OTP_PENDING_KEY = 'becca_otp_pending';   // {userId, hash, exp, channel, target}
  const TRUSTED_KEY_PREFIX = 'becca_trusted_devices_';
  const OTP_TTL_MS = 5 * 60 * 1000;
  const TRUST_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
  const MAX_ATTEMPTS = 5;
  const _attempts = new Map();                    // userId → count (in-memory, reset per page load)

  // ── Helpers ──────────────────────────────────────────────
  async function _sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('becca_2fa_salt_' + str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function _randomCode(len = 6) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(buf[0] % Math.pow(10, len)).padStart(len, '0');
  }
  function _randomBackup() {
    // 8 char base32-ish (alphanum, no confusing chars)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 8; i++) s += chars[buf[i] % chars.length];
    return s.slice(0, 4) + '-' + s.slice(4);
  }
  function _normalizePhone(p) {
    if (!p) return '';
    let s = String(p).replace(/[^\d+]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('0')) s = '62' + s.slice(1);
    if (!s.startsWith('62')) s = '62' + s;
    return s;
  }

  // ── Trusted device ───────────────────────────────────────
  function _trustedKey(userId) { return TRUSTED_KEY_PREFIX + userId; }
  function _getTrusted(userId) {
    try {
      const arr = JSON.parse(localStorage.getItem(_trustedKey(userId)) || '[]');
      const now = Date.now();
      const valid = arr.filter(t => t.exp > now);
      if (valid.length !== arr.length) localStorage.setItem(_trustedKey(userId), JSON.stringify(valid));
      return valid;
    } catch { return []; }
  }
  function isDeviceTrusted(userId) {
    return _getTrusted(userId).length > 0;
  }
  function trustDevice(userId) {
    const arr = _getTrusted(userId);
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    const id = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
    arr.push({ id, exp: Date.now() + TRUST_TTL_MS, ua: navigator.userAgent.slice(0, 100) });
    try { localStorage.setItem(_trustedKey(userId), JSON.stringify(arr.slice(-5))); } catch {}
  }
  function revokeAllTrusted(userId) {
    try { localStorage.removeItem(_trustedKey(userId)); } catch {}
  }

  // ── OTP delivery: Email (EmailJS) ────────────────────────
  // EmailJS template harus punya variables: {{to_name}}, {{otp}}, {{expires_in}}, {{to_email}}
  async function _sendEmail(to, name, code, cfg) {
    if (!cfg.emailjsServiceId || !cfg.emailjsTemplateId || !cfg.emailjsPublicKey) {
      throw new Error('EmailJS belum dikonfigurasi. Buka Settings → Keamanan.');
    }
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.emailjsServiceId,
        template_id: cfg.emailjsTemplateId,
        user_id: cfg.emailjsPublicKey,
        template_params: {
          to_name: name || 'User',
          to_email: to,
          otp: code,
          expires_in: '5 menit',
          app_name: 'BECCA',
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('Gagal kirim email: ' + (res.status === 400 ? 'config EmailJS salah' : res.status) + (txt ? ` (${txt.slice(0, 80)})` : ''));
    }
  }

  // ── OTP delivery: WhatsApp (Fonnte) ──────────────────────
  async function _sendWA(phone, code, cfg) {
    if (!cfg.fonnteToken) {
      throw new Error('Fonnte token belum dikonfigurasi. Buka Settings → Keamanan.');
    }
    const target = _normalizePhone(phone);
    const message = `*BECCA Login Code*\n\nKode verifikasi Anda: *${code}*\n\nBerlaku 5 menit. Jangan share kode ini ke siapapun.`;
    const fd = new FormData();
    fd.append('target', target);
    fd.append('message', message);
    fd.append('countryCode', '62');
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: cfg.fonnteToken },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
      throw new Error('Gagal kirim WA: ' + (data.reason || data.message || res.status));
    }
  }

  // ── OTP send + verify ────────────────────────────────────
  async function sendOTP(user) {
    if (!user || !user.twofaEnabled) throw new Error('2FA tidak aktif untuk user ini');
    const cfg = await DB.getSettings().catch(() => ({}));
    const code = _randomCode(6);
    const hash = await _sha256(code);
    const channel = user.twofaChannel || 'email';
    const target = channel === 'email' ? (user.twofaEmail || user.email) : (user.twofaPhone || '');
    if (!target) throw new Error(`${channel === 'email' ? 'Email' : 'Nomor WhatsApp'} belum di-set di profil 2FA`);

    try {
      if (channel === 'email') {
        await _sendEmail(target, user.nama || user.username, code, cfg);
      } else {
        await _sendWA(target, code, cfg);
      }
    } catch (e) {
      throw new Error(e.message);
    }
    try {
      localStorage.setItem(OTP_PENDING_KEY, JSON.stringify({
        userId: user.id, hash, exp: Date.now() + OTP_TTL_MS, channel,
        target: target.replace(/(.{2}).+(.{2})/, '$1***$2'), // masked for display
      }));
    } catch {}
    _attempts.set(user.id, 0);
    return { channel, targetMasked: target.replace(/(.{2}).+(.{2})/, '$1***$2') };
  }

  async function verifyOTP(user, inputCode) {
    if (!user || !inputCode) return false;
    const attempts = (_attempts.get(user.id) || 0) + 1;
    _attempts.set(user.id, attempts);
    if (attempts > MAX_ATTEMPTS) {
      _clearPending();
      throw new Error('Terlalu banyak percobaan salah. Login ulang.');
    }
    let pending;
    try { pending = JSON.parse(localStorage.getItem(OTP_PENDING_KEY) || 'null'); } catch {}
    if (!pending || pending.userId !== user.id) throw new Error('Tidak ada OTP pending. Klik "Kirim ulang".');
    if (Date.now() > pending.exp) { _clearPending(); throw new Error('OTP kadaluarsa. Klik "Kirim ulang".'); }
    const inputHash = await _sha256(String(inputCode).trim());
    if (inputHash !== pending.hash) return false;
    _clearPending();
    _attempts.delete(user.id);
    return true;
  }

  function _clearPending() {
    try { localStorage.removeItem(OTP_PENDING_KEY); } catch {}
  }

  function getPending() {
    try { return JSON.parse(localStorage.getItem(OTP_PENDING_KEY) || 'null'); } catch { return null; }
  }

  // ── Backup codes ─────────────────────────────────────────
  async function generateBackupCodes(n = 10) {
    const plain = [];
    const hashed = [];
    for (let i = 0; i < n; i++) {
      const c = _randomBackup();
      plain.push(c);
      hashed.push(await _sha256(c));
    }
    return { plain, hashed };
  }
  async function useBackupCode(user, inputCode) {
    if (!user || !inputCode) return false;
    const list = Array.isArray(user.twofaBackupCodes) ? user.twofaBackupCodes : [];
    const inputHash = await _sha256(String(inputCode).trim().toUpperCase());
    const idx = list.indexOf(inputHash);
    if (idx === -1) return false;
    // Mark used by removing from list
    list.splice(idx, 1);
    user.twofaBackupCodes = list;
    try { await DB.saveUser(user); } catch {}
    return true;
  }

  // ── OTP Challenge Modal (during login) ───────────────────
  // Returns Promise<true> if verified, throws on cancel/fail.
  function challenge(user, opts = {}) {
    return new Promise((resolve, reject) => {
      const showTrustOpt = opts.allowTrust !== false;
      let pending = getPending();
      // If no fresh pending (or different user), send now
      const initPromise = (pending && pending.userId === user.id && Date.now() < pending.exp)
        ? Promise.resolve({ channel: pending.channel, targetMasked: pending.target })
        : sendOTP(user);

      initPromise.then(info => {
        const channelLabel = info.channel === 'email' ? '📧 Email' : '💬 WhatsApp';
        Modal.open({
          id: '2fa-challenge',
          title: '🔐 Verifikasi 2 Langkah',
          size: 'modal-sm',
          closable: false,
          body: `
            <div style="text-align:center;padding:8px 4px">
              <div style="font-size:13px;color:var(--text-2);margin-bottom:6px">Kode OTP dikirim via ${channelLabel} ke:</div>
              <div style="font-size:14px;font-weight:700;margin-bottom:14px;color:var(--text-1)">${Utils.esc(info.targetMasked || '')}</div>
              <input id="twofa-otp-input" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="form-control"
                style="text-align:center;font-size:24px;letter-spacing:6px;font-weight:700;font-family:var(--font-mono,monospace);max-width:240px;margin:0 auto"
                placeholder="••••••">
              <div id="twofa-err" class="form-error" style="margin-top:8px;display:none;min-height:18px"></div>
              ${showTrustOpt ? `
                <label style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;font-size:12px;color:var(--text-2);cursor:pointer">
                  <input type="checkbox" id="twofa-trust" style="width:16px;height:16px;cursor:pointer">
                  <span>Percaya device ini 7 hari (skip OTP)</span>
                </label>` : ''}
              <div style="margin-top:14px;display:flex;gap:6px;justify-content:center;font-size:11px">
                <button type="button" id="twofa-resend" class="btn-link" style="background:transparent;border:none;color:var(--primary);cursor:pointer;text-decoration:underline">Kirim ulang</button>
                <span style="color:var(--text-3)">·</span>
                <button type="button" id="twofa-backup" class="btn-link" style="background:transparent;border:none;color:var(--text-2);cursor:pointer;text-decoration:underline">Pakai backup code</button>
              </div>
            </div>
          `,
          footer: `
            <button class="btn btn-secondary" id="twofa-cancel-btn">Batal</button>
            <button class="btn btn-primary" id="twofa-verify-btn">Verifikasi →</button>
          `,
          onOpen: () => {
            const input = document.getElementById('twofa-otp-input');
            const err = document.getElementById('twofa-err');
            const verifyBtn = document.getElementById('twofa-verify-btn');
            const cancelBtn = document.getElementById('twofa-cancel-btn');
            const resendBtn = document.getElementById('twofa-resend');
            const backupBtn = document.getElementById('twofa-backup');
            setTimeout(() => input?.focus(), 80);
            const showErr = (msg) => { err.textContent = msg; err.style.display = 'block'; };
            const doVerify = async () => {
              const code = (input.value || '').trim();
              if (!code) { showErr('Masukkan kode OTP'); return; }
              verifyBtn.disabled = true; verifyBtn.textContent = 'Memverifikasi...';
              try {
                const ok = await verifyOTP(user, code);
                if (!ok) {
                  showErr('Kode salah. Coba lagi.');
                  input.value = '';
                  input.focus();
                  verifyBtn.disabled = false; verifyBtn.textContent = 'Verifikasi →';
                  return;
                }
                if (document.getElementById('twofa-trust')?.checked) trustDevice(user.id);
                Modal.close('2fa-challenge');
                resolve(true);
              } catch (e) {
                showErr(e.message);
                verifyBtn.disabled = false; verifyBtn.textContent = 'Verifikasi →';
              }
            };
            verifyBtn.onclick = doVerify;
            input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doVerify(); } };
            cancelBtn.onclick = () => { _clearPending(); Modal.close('2fa-challenge'); reject(new Error('Verifikasi dibatalkan')); };
            resendBtn.onclick = async () => {
              resendBtn.disabled = true; resendBtn.textContent = 'Mengirim...';
              try {
                await sendOTP(user);
                showErr(''); err.style.display = 'none';
                Notify.success('OTP baru terkirim');
              } catch (e) { showErr(e.message); }
              finally { resendBtn.disabled = false; resendBtn.textContent = 'Kirim ulang'; }
            };
            backupBtn.onclick = () => {
              Modal.open({
                id: '2fa-backup',
                title: '🔑 Backup Code',
                size: 'modal-sm',
                body: `
                  <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">Masukkan salah satu backup code (8 karakter, format XXXX-XXXX):</div>
                  <input id="twofa-backup-input" type="text" maxlength="9" autocomplete="off" class="form-control"
                    style="text-align:center;font-size:18px;letter-spacing:2px;font-family:var(--font-mono,monospace);text-transform:uppercase" placeholder="XXXX-XXXX">
                  <div id="twofa-backup-err" class="form-error" style="margin-top:8px;display:none"></div>
                `,
                footer: `
                  <button class="btn btn-secondary" onclick="Modal.close('2fa-backup')">Batal</button>
                  <button class="btn btn-primary" id="twofa-backup-verify">Pakai →</button>
                `,
                onOpen: () => {
                  document.getElementById('twofa-backup-verify').onclick = async () => {
                    const c = (document.getElementById('twofa-backup-input').value || '').toUpperCase().trim();
                    const ok = await useBackupCode(user, c);
                    if (!ok) {
                      const e = document.getElementById('twofa-backup-err');
                      e.textContent = 'Backup code tidak valid atau sudah dipakai';
                      e.style.display = 'block';
                      return;
                    }
                    Notify.success('Backup code OK. ' + (user.twofaBackupCodes?.length || 0) + ' code tersisa.');
                    Modal.close('2fa-backup');
                    Modal.close('2fa-challenge');
                    resolve(true);
                  };
                },
              });
            };
          },
        });
      }).catch(e => reject(e));
    });
  }

  return {
    sendOTP,
    verifyOTP,
    challenge,
    isDeviceTrusted,
    trustDevice,
    revokeAllTrusted,
    generateBackupCodes,
    useBackupCode,
    _normalizePhone,
    _sha256,
  };
})();
window.TwoFA = TwoFA;
