/* ============================================
   BECCA V2.0 — MediaPicker
   Bottom sheet picker: Kamera / Galeri
   Usage: const dataUrl = await MediaPicker.pick({ maxPx: 512, quality: 0.8 });
   Returns: base64 dataUrl string | null
============================================ */
const MediaPicker = (() => {
  'use strict';

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const TIMEOUT_MS = 15000; // 15s timeout for compress/read

  // ── Compress image with timeout ─────────────────────────
  function _compress(dataUrl, maxPx, quality) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { resolve(null); }, TIMEOUT_MS);
      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        let w = img.width, h = img.height;
        if (w > maxPx || h > maxPx) {
          if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else        { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        clearTimeout(timer);
        if (typeof Notify !== 'undefined') Notify.error('Gambar tidak bisa diproses');
        resolve(null);
      };
      img.src = dataUrl;
    });
  }

  // ── File → dataUrl with timeout ─────────────────────────
  function _read(file) {
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { rej(new Error('Timeout membaca file')); }, TIMEOUT_MS);
      const r = new FileReader();
      r.onload  = e => { clearTimeout(timer); res(e.target.result); };
      r.onerror = () => { clearTimeout(timer); rej(new Error('Gagal membaca file')); };
      r.readAsDataURL(file);
    });
  }

  // ── Preview overlay dengan Gunakan / Ulang ──────────────
  function _preview(dataUrl) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.style.cssText = [
        'position:fixed;inset:0;z-index:10001',
        'background:rgba(0,0,0,.92)',
        'display:flex;flex-direction:column;align-items:center;justify-content:center',
        'gap:16px;padding:24px;',
      ].join(';');
      ov.innerHTML = `
        <div style="font-size:15px;font-weight:600;color:#fff;letter-spacing:.01em">Preview Foto</div>
        <img src="${dataUrl}"
             style="max-width:100%;max-height:55vh;border-radius:12px;object-fit:contain;box-shadow:0 8px 32px rgba(0,0,0,.6)">
        <div style="display:flex;gap:12px">
          <button id="mp-retake"
            style="padding:11px 22px;background:rgba(255,255,255,.1);color:#fff;
                   border:1px solid rgba(255,255,255,.2);border-radius:8px;font-size:14px;cursor:pointer">
            ↩ Ulang
          </button>
          <button id="mp-use"
            style="padding:11px 22px;background:var(--primary,#6366f1);color:#fff;
                   border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">
            ✓ Gunakan
          </button>
        </div>`;
      document.body.appendChild(ov);
      ov.querySelector('#mp-use').onclick    = () => { ov.remove(); resolve(true);  };
      ov.querySelector('#mp-retake').onclick = () => { ov.remove(); resolve(false); };
    });
  }

  // ── Buka file input tersembunyi ─────────────────────────
  async function _openInput(capture, opts) {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = opts.accept || 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    document.body.appendChild(input);

    return new Promise(resolve => {
      input.onchange = async () => {
        const file = input.files[0];
        input.remove();
        if (!file) { resolve(null); return; }

        // Size check BEFORE reading into memory
        if (file.size > MAX_FILE_SIZE) {
          if (typeof Notify !== 'undefined') Notify.warning('File terlalu besar (maks 10MB)');
          resolve(null); return;
        }

        // MIME type validation
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          if (typeof Notify !== 'undefined') Notify.warning('Format file tidak didukung');
          resolve(null); return;
        }

        try {
          const raw = await _read(file);
          const compressed = await _compress(raw, opts.maxPx, opts.quality);
          if (!compressed) {
            if (typeof Notify !== 'undefined') Notify.error('Gagal memproses foto');
            resolve(null); return;
          }
          if (opts.preview !== false) {
            const ok = await _preview(compressed);
            resolve(ok ? compressed : null);
          } else {
            resolve(compressed);
          }
        } catch(e) {
          if (typeof Notify !== 'undefined') Notify.error(e.message || 'Gagal memproses file');
          resolve(null);
        }
      };
      // Jika user cancel — resolve null setelah focus kembali ke window
      const onFocus = () => {
        window.removeEventListener('focus', onFocus);
        setTimeout(() => { if (!input.files?.length) { input.remove(); resolve(null); } }, 500);
      };
      window.addEventListener('focus', onFocus);
      input.click();
    });
  }

  // ── Public: tampilkan bottom sheet picker ───────────────
  function pick(opts = {}) {
    const maxPx   = opts.maxPx   || 512;
    const quality = opts.quality || 0.80;
    const merged  = { ...opts, maxPx, quality };

    return new Promise(resolve => {
      const sheet = document.createElement('div');
      sheet.style.cssText = [
        'position:fixed;inset:0;z-index:10000',
        'background:rgba(0,0,0,.55)',
        'display:flex;align-items:flex-end;justify-content:center',
      ].join(';');

      const btnStyle = [
        'width:100%;padding:14px 16px',
        'background:var(--surface2,#252a3a)',
        'border:1px solid var(--border,#333)',
        'border-radius:10px',
        'color:var(--text,#f0f0f0)',
        'font-size:15px;text-align:left',
        'cursor:pointer;display:flex;align-items:center;gap:14px',
        'margin-bottom:10px',
      ].join(';');

      sheet.innerHTML = `
        <div style="background:var(--surface,#1e2330);border-radius:16px 16px 0 0;
                    padding:20px 16px 32px;width:100%;max-width:480px;
                    box-shadow:0 -4px 24px rgba(0,0,0,.4)">
          <div style="width:36px;height:4px;background:var(--border,#333);
                      border-radius:2px;margin:0 auto 20px"></div>
          <div style="font-size:12px;font-weight:600;color:var(--text-3,#888);
                      text-align:center;letter-spacing:.08em;text-transform:uppercase;
                      margin-bottom:14px">Pilih Foto</div>
          <button id="mp-camera"  style="${btnStyle}">
            <span style="font-size:22px">📷</span> Kamera
          </button>
          <button id="mp-gallery" style="${btnStyle}">
            <span style="font-size:22px">🖼️</span> Galeri / File
          </button>
          <button id="mp-cancel"
            style="width:100%;padding:12px;background:transparent;border:none;
                   color:var(--text-3,#888);font-size:14px;cursor:pointer;margin-top:4px">
            Batal
          </button>
        </div>`;
      document.body.appendChild(sheet);

      async function choose(capture) {
        sheet.remove();
        const result = await _openInput(capture, merged);
        resolve(result);
      }

      sheet.querySelector('#mp-camera').onclick  = () => choose(true);
      sheet.querySelector('#mp-gallery').onclick = () => choose(false);
      sheet.querySelector('#mp-cancel').onclick  = () => { sheet.remove(); resolve(null); };
      sheet.addEventListener('click', e => {
        if (e.target === sheet) { sheet.remove(); resolve(null); }
      });
    });
  }

  return { pick };
})();

window.MediaPicker = MediaPicker;
