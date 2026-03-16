/* ============================================
   BECCA V2.0 — Customer Module
============================================ */
const CustomerModule = (() => {
  let _customers = [];
  let _search    = '';

  async function init() {
    const page = document.getElementById('page-customer');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Data Customer</h2>
          <p>Manajemen data perusahaan klien</p>
        </div>
        <div class="page-header-right">
          ${Auth.can('customer','edit') ? `
            <button class="btn btn-primary" onclick="CustomerModule.openModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Tambah Customer
            </button>
          ` : ''}
        </div>
      </div>
      <div id="customer-content"></div>
    `;
    _customers = await DB.getCustomers().catch(() => []);
    render();
  }

  function render() {
    let data = _customers;
    if (_search) data = data.filter(c =>
      (c.nama||'').toLowerCase().includes(_search.toLowerCase()) ||
      (c.pic||'').toLowerCase().includes(_search.toLowerCase())
    );

    document.getElementById('customer-content').innerHTML = `
      <div class="filter-bar">
        <input type="text" class="form-control" placeholder="Cari nama / PIC..."
               value="${_search}" oninput="CustomerModule.setSearch(this.value)" style="width:240px">
        <span class="text-muted text-small" style="margin-left:auto">${data.length} customer</span>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th><th>Nama Perusahaan</th><th>PIC</th>
              <th>No. Telp</th><th>Alamat</th><th>Catatan</th>
              ${Auth.can('customer','edit') ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${data.length ? data.map((c,i) => `
              <tr>
                <td class="text-muted text-small">${i+1}</td>
                <td class="font-semibold">${c.nama||'-'}</td>
                <td>${c.pic||'-'}</td>
                <td class="text-small">${c.telp||'-'}</td>
                <td class="text-muted text-small" style="max-width:200px">${c.alamat||'-'}</td>
                <td class="text-muted text-small">${c.catatan||'-'}</td>
                ${Auth.can('customer','edit') ? `
                  <td class="actions">
                    <div style="display:flex;gap:4px">
                      <button class="btn-icon" onclick="CustomerModule.openModal('${c.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                ` : ''}
              </tr>
            `).join('') : `
              <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada customer</td></tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  function setSearch(val) { _search = val; render(); }

  function openModal(editId = null) {
    const existing = editId ? _customers.find(c => c.id === editId) : null;
    const d = existing || {};
    const mid = Modal.open({
      title: editId ? 'Edit Customer' : 'Tambah Customer',
      body: `
        <form id="cust-form">
          <div class="form-group">
            <label class="form-label">Nama Perusahaan <span class="req">*</span></label>
            <input name="nama" class="form-control" value="${d.nama||''}" required placeholder="PT. ...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">PIC (Person in Charge)</label>
              <input name="pic" class="form-control" value="${d.pic||''}">
            </div>
            <div class="form-group">
              <label class="form-label">No. Telepon</label>
              <input name="telp" class="form-control" value="${d.telp||''}" placeholder="08xx...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Alamat</label>
            <input name="alamat" class="form-control" value="${d.alamat||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input name="email" type="email" class="form-control" value="${d.email||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Catatan</label>
            <input name="catatan" class="form-control" value="${d.catatan||''}">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="CustomerModule._submit('${mid}','${editId||''}')">
          ${editId ? 'Simpan' : 'Tambah Customer'}
        </button>
      `,
    });
    return mid;
  }

  async function _submit(modalId, editId='') {
    const fd   = new FormData(document.getElementById('cust-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.nama) { Notify.warning('Nama perusahaan wajib diisi'); return; }
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveCustomer(data);
      const idx   = _customers.findIndex(c => c.id === saved.id);
      if (idx >= 0) _customers[idx] = saved; else _customers.unshift(saved);
      render();
      Modal.close(modalId);
      Notify.success(editId ? 'Customer diperbarui' : 'Customer ditambahkan');
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return { init, setSearch, openModal, _submit };
})();
window.CustomerModule = CustomerModule;
