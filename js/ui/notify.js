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
    const root = document.getElementById('toast-root');
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
};

window.Notify = Notify;
