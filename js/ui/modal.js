/* ============================================
   BECCA V2.0 — Modal System (Dynamic)
   ============================================ */

const Modal = {
  _stack: [],
  _handlers: {}, // per-modal escape handlers: { id: fn }

  /* Open a modal
   * opts = {
   *   id: 'unique-id',
   *   title: 'Judul Modal',
   *   size: '' | 'modal-lg' | 'modal-xl',
   *   body: 'HTML string',
   *   footer: 'HTML string' (optional),
   *   onOpen: (modalEl) => {},
   *   closable: true
   * }
   */
  open(opts) {
    const id = opts.id || Utils.uid();
    const closable = opts.closable !== false;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = `modal-backdrop-${id}`;
    if (closable) backdrop.onclick = (e) => { if (e.target === backdrop) Modal.close(id); };

    // Jika lazy:true — render body di frame berikutnya agar tombol footer
    // muncul SEGERA tanpa menunggu parse puluhan form field
    const lazy = opts.lazy === true;
    const bodyHtml = lazy
      ? '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:13px">Memuat...</div>'
      : (opts.body || '');

    backdrop.innerHTML = `
      <div class="modal ${opts.size || ''}" id="modal-${id}" role="dialog">
        <div class="modal-header">
          <div class="modal-title">${opts.title || ''}</div>
          ${closable ? `<button class="modal-close" onclick="Modal.close('${id}')" title="Tutup">×</button>` : ''}
        </div>
        <div class="modal-body" id="modal-body-${id}">${bodyHtml}</div>
        ${opts.footer !== undefined ? `<div class="modal-footer">${opts.footer}</div>` : ''}
      </div>
    `;

    document.getElementById('modal-root').appendChild(backdrop);
    this._stack.push(id);

    if (closable) {
      const handler = (e) => { if (e.key === 'Escape') Modal.close(id); };
      this._handlers[id] = handler;
      document.addEventListener('keydown', handler);
    }

    if (lazy && opts.body) {
      // Isi body setelah browser sempat render modal shell + tombol footer
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const bodyEl = document.getElementById(`modal-body-${id}`);
        if (bodyEl) bodyEl.innerHTML = opts.body;
        if (opts.onOpen) opts.onOpen(document.getElementById(`modal-${id}`));
      }));
    } else {
      if (opts.onOpen) opts.onOpen(document.getElementById(`modal-${id}`));
    }

    return id;
  },

  close(id) {
    const backdrop = document.getElementById(`modal-backdrop-${id}`);
    if (!backdrop) return;
    backdrop.style.animation = 'backdropIn 0.2s ease reverse';
    setTimeout(() => { backdrop.remove(); }, 180);
    this._stack = this._stack.filter(i => i !== id);

    // Hapus HANYA handler milik modal ini
    if (this._handlers[id]) {
      document.removeEventListener('keydown', this._handlers[id]);
      delete this._handlers[id];
    }
  },

  closeAll() {
    [...this._stack].forEach(id => this.close(id));
    this._stack = [];
  },

  /* Konfirmasi dialog */
  confirm(opts) {
    return new Promise((resolve) => {
      const id = Utils.uid();
      const iconType = opts.danger ? 'danger' : 'warning';
      const icon = opts.danger ? '🗑' : '⚠️';

      Modal.open({
        id,
        title: opts.title || 'Konfirmasi',
        size: '',
        body: `
          <div class="confirm-dialog">
            <div class="confirm-icon ${iconType}">${icon}</div>
            <div class="confirm-title">${opts.title || 'Yakin?'}</div>
            <p class="confirm-desc">${opts.message || ''}</p>
          </div>
        `,
        footer: `
          <button class="btn btn-ghost" id="confirm-cancel-${id}">Batal</button>
          <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-${id}">
            ${opts.confirmText || 'Ya, Lanjutkan'}
          </button>
        `,
      });

      document.getElementById(`confirm-ok-${id}`).onclick = () => {
        Modal.close(id);
        resolve(true);
      };

      // Override escape handler untuk confirm dialog agar resolve(false)
      if (Modal._handlers[id]) {
        document.removeEventListener('keydown', Modal._handlers[id]);
      }
      const escHandler = (e) => {
        if (e.key === 'Escape') { Modal.close(id); resolve(false); }
      };
      Modal._handlers[id] = escHandler;
      document.addEventListener('keydown', escHandler);

      // Tombol batal juga resolve(false)
      const cancelBtn = document.getElementById(`confirm-cancel-${id}`);
      if (cancelBtn) cancelBtn.onclick = () => { Modal.close(id); resolve(false); };
    });
  },
};

window.Modal = Modal;
