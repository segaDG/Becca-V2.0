/* ============================================
   BECCA V2.0 — Notify (Toast System)
   ============================================ */

const Notify = {
  _icons: {
    success: '✓',
    error:   '✕',
    warning: '!',
    info:    'i',
  },

  _show(title, msg, type = 'info', ms = 4000) {
    const root = document.getElementById('toast-container');
    if (!root) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <div class="toast-icon-wrap">${this._icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px;padding:0 0 0 8px;line-height:1">×</button>
    `;

    root.appendChild(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('show'));
    });

    if (ms > 0) {
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 350);
      }, ms);
    }
  },

  success(title, msg = '') { this._show(title, msg, 'success'); },
  error  (title, msg = '') { this._show(title, msg, 'error',   6000); },
  warning(title, msg = '') { this._show(title, msg, 'warning'); },
  info   (title, msg = '') { this._show(title, msg, 'info'); },

  // Snackbar bawah layar dengan tombol Undo
  undo(title, onUndo, ms = 5000) {
    document.getElementById('_undo-snack')?.remove();
    const el = document.createElement('div');
    el.id = '_undo-snack';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;background:#1e293b;color:#f8fafc;border-radius:10px;padding:10px 16px 10px 18px;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap;transition:opacity .25s,transform .25s';
    el.innerHTML = `
      <span>${title}</span>
      <button id="_undo-act" style="background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:700">↩ Undo</button>
      <button id="_undo-cls" style="background:none;border:none;color:rgba(248,250,252,.5);cursor:pointer;font-size:20px;padding:0 0 0 4px;line-height:1">×</button>
    `;
    document.body.appendChild(el);
    const remove = () => {
      el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(8px)';
      setTimeout(() => el.remove(), 250);
    };
    const timer = setTimeout(remove, ms);
    el.querySelector('#_undo-act').onclick = () => { clearTimeout(timer); el.remove(); onUndo(); };
    el.querySelector('#_undo-cls').onclick = () => { clearTimeout(timer); remove(); };
  },

  // Popup validasi kecil — hilang saat klik di luar atau tekan ×
  popup(msg) {
    document.getElementById('_val-popup')?.remove();
    const overlay = document.createElement('div');
    overlay.id = '_val-popup';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9990;display:flex;align-items:flex-start;justify-content:center;padding-top:70px';
    overlay.innerHTML = `
      <div onclick="event.stopPropagation()" style="background:var(--surface);border:1.5px solid var(--warning);border-radius:var(--r-md);padding:14px 18px;max-width:340px;min-width:240px;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:flex-start;gap:10px">
        <div style="color:var(--warning);font-size:16px;flex-shrink:0;line-height:1.5">⚠</div>
        <div style="font-size:13px;color:var(--text);line-height:1.5;flex:1">${msg}</div>
        <button onclick="document.getElementById('_val-popup')?.remove()" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:18px;padding:0;line-height:1;flex-shrink:0;margin-left:4px">×</button>
      </div>
    `;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  },
};

window.Notify = Notify;
