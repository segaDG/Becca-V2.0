/* ============================================
   BECCA V2.0 — Modal System (Dynamic)
   ============================================ */

const Modal = {
  _stack: [],

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

    backdrop.innerHTML = `
      <div class="modal ${opts.size || ''}" id="modal-${id}" role="dialog">
        <div class="modal-header">
          <div class="modal-title">${opts.title || ''}</div>
          ${closable ? `<button class="modal-close" onclick="Modal.close('${id}')" title="Tutup">×</button>` : ''}
        </div>
        <div class="modal-body">
          ${opts.body || ''}
        </div>
        ${opts.footer !== undefined ? `<div class="modal-footer">${opts.footer}</div>` : ''}
      </div>
    `;

    document.getElementById('modal-root').appendChild(backdrop);
    this._stack.push(id);

    if (opts.onOpen) {
      opts.onOpen(document.getElementById(`modal-${id}`));
    }

    // trap escape key
    this._escHandler = (e) => { if (e.key === 'Escape' && closable) this.close(id); };
    document.addEventListener('keydown', this._escHandler);

    return id;
  },

  close(id) {
    const backdrop = document.getElementById(`modal-backdrop-${id}`);
    if (!backdrop) return;
    backdrop.style.animation = 'backdropIn 0.2s ease reverse';
    setTimeout(() => { backdrop.remove(); }, 180);
    this._stack = this._stack.filter(i => i !== id);
    document.removeEventListener('keydown', this._escHandler);
  },

  closeAll() {
    this._stack.forEach(id => this.close(id));
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
          <button class="btn btn-ghost" onclick="Modal.close('${id}')">Batal</button>
          <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-${id}">
            ${opts.confirmText || 'Ya, Lanjutkan'}
          </button>
        `,
      });

      document.getElementById(`confirm-ok-${id}`).onclick = () => {
        Modal.close(id);
        resolve(true);
      };

      // Batal → resolve false
      const orig = Modal._escHandler;
      Modal._escHandler = (e) => {
        if (e.key === 'Escape') { Modal.close(id); resolve(false); }
      };
    });
  },
};

window.Modal = Modal;
