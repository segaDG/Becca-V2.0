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

  // Toast dengan tombol Undo — onUndo dipanggil jika user tekan Undo sebelum timer habis
  undo(title, onUndo, ms = 5000) {
    const root = document.getElementById('toast-container');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast toast-warning';
    el.innerHTML = `
      <div class="toast-icon-wrap">!</div>
      <div class="toast-content"><div class="toast-title">${title}</div></div>
      <button class="_undo-btn" style="background:var(--primary);border:none;color:white;cursor:pointer;font-size:11px;font-weight:700;padding:4px 12px;border-radius:4px;margin-left:8px;white-space:nowrap">↩ Undo</button>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px;padding:0 0 0 8px;line-height:1">×</button>
    `;
    el.querySelector('._undo-btn').onclick = () => { el.remove(); onUndo(); };
    root.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, ms);
  },
};

window.Notify = Notify;
