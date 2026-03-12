/* ============================================
   BECCA V2.0 — Order Module
   Depends: db.js, utils.js, modal.js, notify.js
   ============================================ */

const OrderModule = (() => {
  let _orders = [];
  let _customers = [];
  let _columns = []; // kolom dinamis porsi
  let _filter = { tipe: '', customer: '' };
  let _activeTab = 'input'; // 'input' | 'list' | 'report'

  /* === RENDER PAGE === */
  async function init() {
    const page = document.getElementById('page-order');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Order Catering</h2>
          <p>Input dan kelola orderan harian</p>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="input"  onclick="OrderModule.switchTab('input')">➕ Input Order</button>
        <button class="tab-btn"        data-tab="list"   onclick="OrderModule.switchTab('list')">📦 Semua Order</button>
        <button class="tab-btn"        data-tab="report" onclick="OrderModule.switchTab('report')">📊 Laporan</button>
      </div>
      <div id="order-tab-input"></div>
      <div id="order-tab-list"   class="hidden"></div>
      <div id="order-tab-report" class="hidden"></div>
    `;

    [_orders, _customers, _columns] = await Promise.all([
      DB.getOrders(), DB.getCustomers(), _loadColumns(),
    ]);

    renderInputTab();
    renderListTab();
    switchTab('input');
  }

  async function _loadColumns() {
    const settings = await DB.getSettings();
    return settings.columns || [
      { key:'shift1', label:'Shift 1', active:true },
      { key:'spare1', label:'Spare 1', active:true },
      { key:'ot1',    label:'OT 1',    active:true },
      { key:'snack1', label:'Snack 1', active:true },
      { key:'shift2', label:'Shift 2', active:true },
      { key:'spare2', label:'Spare 2', active:true },
      { key:'ot2',    label:'OT 2',    active:true },
      { key:'snack2', label:'Snack 2', active:true },
      { key:'shift3', label:'Shift 3', active:true },
      { key:'spare3', label:'Spare 3', active:true },
      { key:'ot3',    label:'OT 3',    active:true },
      { key:'snack3', label:'Snack 3', active:true },
      { key:'breakfast',   label:'Breakfast',   active:true },
      { key:'snack_berat', label:'Snack Berat', active:true },
    ];
  }

  function switchTab(tab) {
    _activeTab = tab;
    ['input','list','report'].forEach(t => {
      const el = document.getElementById(`order-tab-${t}`);
      const btn = document.querySelector(`[data-tab="${t}"]`);
      if (el) el.classList.toggle('hidden', t !== tab);
      if (btn) btn.classList.toggle('active', t === tab);
    });
  }

  /* === INPUT TAB === */
  function renderInputTab() {
    const activeCols = _columns.filter(c => c.active);
    const custOptions = _customers.map(c =>
      `<option value="${c.id}">${c.nama}</option>`
    ).join('');

    document.getElementById('order-tab-input').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 340px;gap:var(--s5)">
        <!-- Form Input -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Input Order Baru
            </div>
          </div>
          <form id="order-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tanggal Order <span class="req">*</span></label>
                <input name="tanggal" type="date" class="form-control" value="${Utils.today()}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Customer <span class="req">*</span></label>
                <select name="customerId" class="form-control" onchange="OrderModule.onCustomerChange(this.value)" required>
                  <option value="">— Pilih Customer —</option>
                  ${custOptions}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Tipe Order</label>
              <div style="display:flex;gap:var(--s3)">
                <label class="form-check"><input type="radio" name="tipe" value="real" checked> <span class="form-check-label">✅ Real Orderan</span></label>
                <label class="form-check"><input type="radio" name="tipe" value="estimasi"> <span class="form-check-label">📋 Estimasi</span></label>
              </div>
            </div>

            <!-- Kolom Porsi Dinamis -->
            <div style="margin-bottom:var(--s4)">
              <div class="section-title">Jumlah Porsi</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3)">
                ${activeCols.map(col => `
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label">${col.label}</label>
                    <input name="${col.key}" type="number" min="0" value="0" class="form-control" style="text-align:center">
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Catatan</label>
              <textarea name="catatan" class="form-control" rows="2" placeholder="Catatan tambahan..."></textarea>
            </div>

            <div style="display:flex;gap:var(--s2)">
              <button type="submit" class="btn btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
                Simpan Order
              </button>
              <button type="button" class="btn btn-ghost" onclick="OrderModule.resetForm()">↺ Reset</button>
            </div>
          </form>
        </div>

        <!-- Info Customer Panel -->
        <div class="card" id="customer-info-panel">
          <div class="card-header">
            <div class="card-title">Info Customer</div>
          </div>
          <div id="customer-info-body">
            <div class="empty-state" style="padding:var(--s8) var(--s4)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <p>Pilih customer untuk melihat info</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('order-form').onsubmit = async (e) => {
      e.preventDefault();
      await saveOrder(new FormData(e.target));
    };
  }

  function onCustomerChange(custId) {
    const cust = _customers.find(c => c.id === custId);
    const panel = document.getElementById('customer-info-body');
    if (!cust) {
      panel.innerHTML = `<div class="empty-state" style="padding:var(--s8) var(--s4)"><p>Pilih customer</p></div>`;
      return;
    }
    panel.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--s3)">
        <div>
          <div class="text-small text-muted">Nama Perusahaan</div>
          <div style="font-weight:600;color:var(--heading)">${cust.nama}</div>
        </div>
        <div>
          <div class="text-small text-muted">Jenis Layanan</div>
          <div>${cust.jenis || '-'}</div>
        </div>
        <div>
          <div class="text-small text-muted">Harga Default/Pax</div>
          <div style="font-family:var(--font-mono);color:var(--success)">${Utils.formatRupiah(cust.hargaDefault)}</div>
        </div>
        <div>
          <div class="text-small text-muted">Tempo Pembayaran</div>
          <div>${cust.tempo || 0} Hari</div>
        </div>
        ${cust.catatan ? `<div><div class="text-small text-muted">Catatan</div><div class="text-small">${cust.catatan}</div></div>` : ''}
      </div>
    `;
  }

  async function saveOrder(fd) {
    const data = Object.fromEntries(fd.entries());
    if (!data.tanggal || !data.customerId) {
      Notify.error('Validasi Gagal', 'Tanggal dan Customer wajib diisi');
      return;
    }
    const cust = _customers.find(c => c.id === data.customerId);
    const order = {
      id: Utils.uid(),
      tanggal: data.tanggal,
      customerId: data.customerId,
      customerNama: cust?.nama || '',
      tipe: data.tipe,
      catatan: data.catatan,
      createdAt: new Date().toISOString(),
      createdBy: Auth.currentUser()?.username,
      revisi: 0,
      porsi: {},
    };

    // Kumpulkan porsi dari kolom aktif
    _columns.filter(c => c.active).forEach(col => {
      order.porsi[col.key] = parseInt(data[col.key]) || 0;
    });
    order.totalPorsi = Object.values(order.porsi).reduce((s,n) => s+n, 0);

    // Cek duplikat
    const dup = _orders.find(o => o.tanggal === order.tanggal && o.customerId === order.customerId);
    if (dup) {
      const ok = await Modal.confirm({
        title: 'Order Sudah Ada',
        message: `Sudah ada order ${cust?.nama} tanggal ${Utils.formatDate(order.tanggal)}. Perbarui?`,
        confirmText: 'Ya, Perbarui',
        danger: false,
      });
      if (!ok) return;
      order.id = dup.id;
      order.revisi = (dup.revisi || 0) + 1;
    }

    try {
      const saved = await DB.saveOrder(order);
      const idx = _orders.findIndex(o => o.id === saved.id);
      if (idx >= 0) _orders[idx] = saved; else _orders.unshift(saved);
      renderListTab();
      resetForm();
      Notify.success('Order disimpan!', `${cust?.nama} — ${Utils.formatDate(order.tanggal)}`);
      await DB.logActivity({ type: 'order', detail: `Simpan order ${cust?.nama}` });
    } catch (err) {
      Notify.error('Gagal menyimpan', err.message);
    }
  }

  function resetForm() {
    const form = document.getElementById('order-form');
    if (!form) return;
    form.reset();
    form.querySelector('[name=tanggal]').value = Utils.today();
    // reset semua angka ke 0
    form.querySelectorAll('[type=number]').forEach(el => el.value = 0);
    onCustomerChange('');
  }

  /* === LIST TAB === */
  function renderListTab() {
    const activeCols = _columns.filter(c => c.active);
    const custOptions = _customers.map(c =>
      `<option value="${c.id}" ${_filter.customer===c.id?'selected':''}>${c.nama}</option>`
    ).join('');

    let filtered = _orders;
    if (_filter.tipe)     filtered = filtered.filter(o => o.tipe === _filter.tipe);
    if (_filter.customer) filtered = filtered.filter(o => o.customerId === _filter.customer);

    const rows = filtered.length ? filtered.map(o => `
      <tr>
        <td>${Utils.formatDate(o.tanggal, 'dd mmm yyyy')}</td>
        <td><span class="font-semibold">${o.customerNama}</span></td>
        <td>${o.createdBy || '-'}</td>
        <td>${Utils.formatDate(o.createdAt,'dd/mm/yyyy')}</td>
        ${activeCols.map(c => `<td class="num">${o.porsi?.[c.key] || 0}</td>`).join('')}
        <td class="num"><strong>${o.totalPorsi || 0}</strong></td>
        <td><span class="badge ${o.revisi > 0 ? 'badge-warning':'badge-neutral'}">${o.revisi||0}</span></td>
        <td><span class="badge ${o.tipe==='real'?'badge-success':'badge-info'}">${o.tipe==='real'?'Real':'Estimasi'}</span></td>
        <td class="actions">
          <div style="display:flex;gap:4px">
            <button class="btn-icon" title="Edit" onclick="OrderModule.editOrder('${o.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" title="Hapus" onclick="OrderModule.deleteOrder('${o.id}')" style="color:var(--danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="${5+activeCols.length}" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada order</td></tr>`;

    document.getElementById('order-tab-list').innerHTML = `
      <div class="filter-bar">
        <select class="form-control" onchange="OrderModule.setFilter('tipe',this.value)">
          <option value="">Semua Tipe</option>
          <option value="real" ${_filter.tipe==='real'?'selected':''}>Real</option>
          <option value="estimasi" ${_filter.tipe==='estimasi'?'selected':''}>Estimasi</option>
        </select>
        <select class="form-control" onchange="OrderModule.setFilter('customer',this.value)">
          <option value="">Semua Customer</option>
          ${custOptions}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="OrderModule.setFilter('reset')">↺ Reset</button>
        <span class="text-muted text-small" style="margin-left:auto">${filtered.length} order</span>
      </div>
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Tanggal</th><th>Customer</th><th>Diinput</th><th>Waktu</th>
                ${activeCols.map(c => `<th class="num">${c.label}</th>`).join('')}
                <th class="num">Total</th><th>Rev</th><th>Tipe</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setFilter(key, val) {
    if (key === 'reset') _filter = { tipe:'', customer:'' };
    else _filter[key] = val;
    renderListTab();
  }

  async function editOrder(id) {
    const order = _orders.find(o => o.id === id);
    if (!order) return;
    const activeCols = _columns.filter(c => c.active);
    const custOptions = _customers.map(c =>
      `<option value="${c.id}" ${c.id===order.customerId?'selected':''}>${c.nama}</option>`
    ).join('');
    const modalId = Modal.open({
      title: 'Edit Order',
      size: 'modal-lg',
      body: `
        <form id="edit-order-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal</label>
              <input name="tanggal" type="date" class="form-control" value="${order.tanggal}">
            </div>
            <div class="form-group">
              <label class="form-label">Customer</label>
              <select name="customerId" class="form-control">${custOptions}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tipe</label>
            <div style="display:flex;gap:var(--s3)">
              <label class="form-check"><input type="radio" name="tipe" value="real" ${order.tipe==='real'?'checked':''}> <span class="form-check-label">Real</span></label>
              <label class="form-check"><input type="radio" name="tipe" value="estimasi" ${order.tipe==='estimasi'?'checked':''}> <span class="form-check-label">Estimasi</span></label>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s4)">
            ${activeCols.map(col => `
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">${col.label}</label>
                <input name="${col.key}" type="number" min="0" value="${order.porsi?.[col.key]||0}" class="form-control" style="text-align:center">
              </div>
            `).join('')}
          </div>
          <div class="form-group">
            <label class="form-label">Catatan Revisi <span class="req">*</span></label>
            <textarea name="catatanRevisi" class="form-control" rows="2" placeholder="Alasan perubahan..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Catatan</label>
            <textarea name="catatan" class="form-control" rows="2">${order.catatan||''}</textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${modalId}')">Batal</button>
        <button class="btn btn-primary" onclick="OrderModule._submitEdit('${id}','${modalId}')">Simpan</button>
      `,
    });
  }

  async function _submitEdit(id, modalId) {
    const form = document.getElementById('edit-order-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.catatanRevisi) { Notify.warning('Isi catatan revisi'); return; }
    const order = _orders.find(o => o.id === id);
    const updated = { ...order, ...data, revisi: (order.revisi||0)+1, updatedAt: new Date().toISOString() };
    updated.porsi = {};
    _columns.filter(c => c.active).forEach(col => { updated.porsi[col.key] = parseInt(data[col.key])||0; });
    updated.totalPorsi = Object.values(updated.porsi).reduce((s,n)=>s+n,0);
    try {
      await DB.saveOrder(updated);
      const idx = _orders.findIndex(o => o.id === id);
      if (idx >= 0) _orders[idx] = updated;
      renderListTab();
      Modal.close(modalId);
      Notify.success('Order diperbarui');
    } catch (err) { Notify.error('Gagal', err.message); }
  }

  async function deleteOrder(id) {
    const ok = await Modal.confirm({ title:'Hapus Order', message:'Order ini akan dihapus permanen.', danger:true, confirmText:'Hapus' });
    if (!ok) return;
    try {
      await DB.deleteOrder(id);
      _orders = _orders.filter(o => o.id !== id);
      renderListTab();
      Notify.success('Order dihapus');
    } catch (err) { Notify.error('Gagal menghapus', err.message); }
  }

  // Public API
  return { init, switchTab, onCustomerChange, resetForm, setFilter, editOrder, deleteOrder, _submitEdit };
})();

window.OrderModule = OrderModule;
