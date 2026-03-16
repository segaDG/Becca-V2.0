/* ============================================
   BECCA V2.0 — Order Module
   Schema: { id, tglOrder, namaPerusahaan, breakfast, 
     shift1, spare1, ot1, snack1,
     shift2, spare2, ot2, snack2,
     shift3, spare3, ot3, snack3,
     snackBerat, catatan, jenis, pelapor, createdAt }
============================================ */
const OrderModule = (() => {
  let _orders = [];
  let _filter  = { tgl: '', perusahaan: '', jenis: '' };
  let _page    = 1;
  const _perPage = 50;

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-order');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Order Catering</h2>
          <p>Manajemen order masuk dari Telegram BECCAbot</p>
        </div>
        <div class="page-header-right">
          ${Auth.can('order','edit') ? `
            <button class="btn btn-primary" onclick="OrderModule.openModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Tambah Order
            </button>
          ` : ''}
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn active" data-tab="list"    onclick="OrderModule.switchTab('list')">📋 Daftar Order</button>
        <button class="tab-btn"        data-tab="rekap"   onclick="OrderModule.switchTab('rekap')">📊 Rekap per Perusahaan</button>
        <button class="tab-btn"        data-tab="harian"  onclick="OrderModule.switchTab('harian')">📅 Rekap Harian</button>
      </div>

      <div id="ord-tab-list"></div>
      <div id="ord-tab-rekap"  class="hidden"></div>
      <div id="ord-tab-harian" class="hidden"></div>
    `;

    _orders = await DB.getOrders().catch(() => []);
    switchTab('list');
  }

  function switchTab(tab) {
    ['list','rekap','harian'].forEach(t => {
      document.getElementById(`ord-tab-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const renders = { list: renderList, rekap: renderRekap, harian: renderHarian };
    renders[tab]?.();
  }

  /* ===================== TAB: DAFTAR ORDER ===================== */
  function renderList() {
    let filtered = _orders;
    if (_filter.tgl)         filtered = filtered.filter(o => o.tglOrder === _filter.tgl);
    if (_filter.perusahaan)  filtered = filtered.filter(o => (o.namaPerusahaan||'').toLowerCase().includes(_filter.perusahaan.toLowerCase()));
    if (_filter.jenis)       filtered = filtered.filter(o => o.jenis === _filter.jenis);

    const sorted = [...filtered].sort((a,b) => (b.tglOrder||'').localeCompare(a.tglOrder||''));
    const total  = sorted.length;
    const paged  = sorted.slice((_page-1)*_perPage, _page*_perPage);
    const totalPages = Math.max(1, Math.ceil(total / _perPage));

    const perusahaanList = [...new Set(_orders.map(o=>o.namaPerusahaan).filter(Boolean))].sort();

    document.getElementById('ord-tab-list').innerHTML = `
      <!-- Filter Bar -->
      <div class="filter-bar">
        <input type="date" class="form-control" value="${_filter.tgl}"
               style="width:145px" onchange="OrderModule.setFilter('tgl',this.value)"
               placeholder="Filter tanggal">
        <input type="text" class="form-control" value="${_filter.perusahaan}"
               style="width:180px" placeholder="Cari perusahaan..."
               oninput="OrderModule.setFilter('perusahaan',this.value)">
        <select class="form-control" style="width:130px" onchange="OrderModule.setFilter('jenis',this.value)">
          <option value="">Semua Jenis</option>
          <option value="real orderan"   ${_filter.jenis==='real orderan'  ?'selected':''}>Real Orderan</option>
          <option value="estimasi orderan" ${_filter.jenis==='estimasi orderan'?'selected':''}>Estimasi</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="OrderModule.resetFilter()">↺ Reset</button>
        <span class="text-muted text-small" style="margin-left:auto">${total} order</span>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table" style="font-size:12px">
            <thead>
              <tr>
                <th>#</th>
                <th style="white-space:nowrap">Tgl Order</th>
                <th>Perusahaan</th>
                <th>Jenis</th>
                <th>Pelapor</th>
                <th class="num">Breakfast</th>
                <th class="num">Shift 1</th>
                <th class="num">Spare 1</th>
                <th class="num">OT 1</th>
                <th class="num">Snack 1</th>
                <th class="num">Shift 2</th>
                <th class="num">Spare 2</th>
                <th class="num">OT 2</th>
                <th class="num">Snack 2</th>
                <th class="num">Shift 3</th>
                <th class="num">Spare 3</th>
                <th class="num">OT 3</th>
                <th class="num">Snack 3</th>
                <th class="num">Snack Berat</th>
                <th>Catatan</th>
                ${Auth.can('order','edit') ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${paged.length ? paged.map((o,i) => `
                <tr>
                  <td class="text-muted">${(_page-1)*_perPage+i+1}</td>
                  <td style="white-space:nowrap">${o.tglOrder ? Utils.formatDate(o.tglOrder,'dd/mm/yyyy') : '-'}</td>
                  <td class="font-semibold">${o.namaPerusahaan||'-'}</td>
                  <td>
                    <span class="badge ${o.jenis==='real orderan'?'badge-success':'badge-warning'}">
                      ${o.jenis==='real orderan'?'Real':'Estimasi'}
                    </span>
                  </td>
                  <td class="text-muted">${o.pelapor||'-'}</td>
                  ${_numCell(o.breakfast)}
                  ${_numCell(o.shift1)}
                  ${_numCell(o.spare1)}
                  ${_numCell(o.ot1)}
                  ${_numCell(o.snack1)}
                  ${_numCell(o.shift2)}
                  ${_numCell(o.spare2)}
                  ${_numCell(o.ot2)}
                  ${_numCell(o.snack2)}
                  ${_numCell(o.shift3)}
                  ${_numCell(o.spare3)}
                  ${_numCell(o.ot3)}
                  ${_numCell(o.snack3)}
                  ${_numCell(o.snackBerat)}
                  <td class="text-muted" style="max-width:120px;overflow:hidden;text-overflow:ellipsis">${o.catatan||'-'}</td>
                  ${Auth.can('order','edit') ? `
                    <td class="actions">
                      <div style="display:flex;gap:4px">
                        <button class="btn-icon" onclick="OrderModule.openModal('${o.id}')">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button class="btn-icon" style="color:var(--danger)" onclick="OrderModule.deleteOrder('${o.id}')">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="21" style="text-align:center;padding:40px;color:var(--text-3)">
                    Belum ada order
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        ${totalPages > 1 ? `
          <div class="pagination">
            <span class="pagination-info">Hal ${_page} / ${totalPages} · ${total} data</span>
            <div class="pagination-controls">
              <button class="page-btn" onclick="OrderModule.goPage(${_page-1})" ${_page<=1?'disabled':''}>‹</button>
              <button class="page-btn" onclick="OrderModule.goPage(${_page+1})" ${_page>=totalPages?'disabled':''}>›</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function _numCell(val) {
    const n = parseInt(val) || 0;
    return `<td class="num ${n > 0 ? '' : 'text-muted'}">${n > 0 ? n : '-'}</td>`;
  }

  /* ===================== TAB: REKAP PER PERUSAHAAN ===================== */
  function renderRekap() {
    const byPerusahaan = {};
    _orders.forEach(o => {
      const k = o.namaPerusahaan || 'Unknown';
      if (!byPerusahaan[k]) byPerusahaan[k] = { orders: 0, totalPax: 0 };
      byPerusahaan[k].orders++;
      const totalPax = (parseInt(o.shift1)||0) + (parseInt(o.shift2)||0) + (parseInt(o.shift3)||0);
      byPerusahaan[k].totalPax += totalPax;
    });

    const sorted = Object.entries(byPerusahaan).sort((a,b) => b[1].totalPax - a[1].totalPax);

    document.getElementById('ord-tab-rekap').innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Perusahaan</th>
              <th class="num">Total Order</th>
              <th class="num">Total Pax (Shift 1+2+3)</th>
              <th class="num">Rata-rata Pax/Order</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(([nama, d], i) => `
              <tr>
                <td class="text-muted">${i+1}</td>
                <td class="font-semibold">${nama}</td>
                <td class="num">${d.orders}</td>
                <td class="num">${d.totalPax.toLocaleString('id')}</td>
                <td class="num text-muted">${d.orders > 0 ? Math.round(d.totalPax/d.orders) : 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ===================== TAB: REKAP HARIAN ===================== */
  function renderHarian() {
    const byTgl = {};
    _orders.forEach(o => {
      const k = o.tglOrder || 'Unknown';
      if (!byTgl[k]) byTgl[k] = { orders: [], totalShift1: 0, totalShift2: 0, totalShift3: 0, totalBreakfast: 0 };
      byTgl[k].orders.push(o);
      byTgl[k].totalBreakfast += parseInt(o.breakfast)||0;
      byTgl[k].totalShift1   += parseInt(o.shift1)||0;
      byTgl[k].totalShift2   += parseInt(o.shift2)||0;
      byTgl[k].totalShift3   += parseInt(o.shift3)||0;
    });

    const sorted = Object.entries(byTgl).sort((a,b) => b[0].localeCompare(a[0]));

    document.getElementById('ord-tab-harian').innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th class="num">Perusahaan</th>
              <th class="num">Breakfast</th>
              <th class="num">Shift 1</th>
              <th class="num">Shift 2</th>
              <th class="num">Shift 3</th>
              <th class="num">Total Pax</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(([tgl, d]) => {
              const totalPax = d.totalShift1 + d.totalShift2 + d.totalShift3;
              return `
                <tr>
                  <td class="font-semibold" style="white-space:nowrap">
                    ${tgl !== 'Unknown' ? Utils.formatDate(tgl,'dd/mm/yyyy') : '-'}
                  </td>
                  <td class="num">${d.orders.length}</td>
                  <td class="num">${d.totalBreakfast || '-'}</td>
                  <td class="num">${d.totalShift1 || '-'}</td>
                  <td class="num">${d.totalShift2 || '-'}</td>
                  <td class="num">${d.totalShift3 || '-'}</td>
                  <td class="num font-semibold" style="color:var(--primary-h)">${totalPax}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ===================== FILTER ===================== */
  function setFilter(key, val) { _filter[key] = val; _page = 1; renderList(); }
  function resetFilter() { _filter = {}; _page = 1; renderList(); }
  function goPage(p) { _page = p; renderList(); }

  /* ===================== MODAL ===================== */
  function openModal(editId = null) {
    const existing = editId ? _orders.find(o => o.id === editId) : null;
    const d = existing || { tglOrder: Utils.today ? Utils.today() : new Date().toISOString().split('T')[0] };

    const numInput = (name, label, val) => `
      <div class="form-group">
        <label class="form-label">${label}</label>
        <input name="${name}" type="number" min="0" class="form-control" value="${parseInt(val)||0}">
      </div>
    `;

    const mid = Modal.open({
      title: editId ? 'Edit Order' : 'Tambah Order Baru',
      size:  'modal-lg',
      body: `
        <form id="order-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal Order <span class="req">*</span></label>
              <input name="tglOrder" type="date" class="form-control" value="${d.tglOrder||''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nama Perusahaan <span class="req">*</span></label>
              <input name="namaPerusahaan" class="form-control" value="${d.namaPerusahaan||''}" required placeholder="PT. ...">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Pelapor</label>
              <input name="pelapor" class="form-control" value="${d.pelapor||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Jenis</label>
              <select name="jenis" class="form-control">
                <option value="real orderan"    ${(d.jenis||'real orderan')==='real orderan'   ?'selected':''}>Real Orderan</option>
                <option value="estimasi orderan" ${d.jenis==='estimasi orderan'?'selected':''}>Estimasi Orderan</option>
              </select>
            </div>
          </div>

          <div style="border-top:1px solid var(--border);margin:var(--s4) 0;padding-top:var(--s4)">
            <div class="text-small font-semibold" style="margin-bottom:var(--s3);color:var(--text-2)">BREAKFAST & SHIFT</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:var(--s3)">
              ${numInput('breakfast','Breakfast',d.breakfast)}
              ${numInput('shift1','Shift 1',d.shift1)}
              ${numInput('spare1','Spare 1',d.spare1)}
              ${numInput('ot1','OT 1',d.ot1)}
              ${numInput('snack1','Snack 1',d.snack1)}
              ${numInput('shift2','Shift 2',d.shift2)}
              ${numInput('spare2','Spare 2',d.spare2)}
              ${numInput('ot2','OT 2',d.ot2)}
              ${numInput('snack2','Snack 2',d.snack2)}
              ${numInput('shift3','Shift 3',d.shift3)}
              ${numInput('spare3','Spare 3',d.spare3)}
              ${numInput('ot3','OT 3',d.ot3)}
              ${numInput('snack3','Snack 3',d.snack3)}
              ${numInput('snackBerat','Snack Berat',d.snackBerat)}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Catatan</label>
            <input name="catatan" class="form-control" value="${d.catatan||''}" placeholder="Catatan tambahan...">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="OrderModule._submitModal('${mid}','${editId||''}')">
          ${editId ? 'Simpan Perubahan' : 'Tambah Order'}
        </button>
      `,
    });
    return mid;
  }

  async function _submitModal(modalId, editId = '') {
    const fd   = new FormData(document.getElementById('order-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.tglOrder || !data.namaPerusahaan) {
      Notify.warning('Tanggal dan Nama Perusahaan wajib diisi');
      return;
    }
    ['breakfast','shift1','spare1','ot1','snack1','shift2','spare2','ot2','snack2',
     'shift3','spare3','ot3','snack3','snackBerat'].forEach(k => {
      data[k] = parseInt(data[k]) || 0;
    });
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveOrder(data);
      const idx   = _orders.findIndex(o => o.id === saved.id);
      if (idx >= 0) _orders[idx] = saved; else _orders.unshift(saved);
      renderList();
      Modal.close(modalId);
      Notify.success(editId ? 'Order diperbarui' : 'Order ditambahkan');
    } catch (err) {
      Notify.error('Gagal simpan', err.message);
    }
  }

  async function deleteOrder(id) {
    const ok = await Modal.confirm({ title:'Hapus Order', message:'Order akan dihapus permanen.', danger:true, confirmText:'Hapus' });
    if (!ok) return;
    await DB.deleteOrder(id);
    _orders = _orders.filter(o => o.id !== id);
    renderList();
    Notify.success('Order dihapus');
  }

  return { init, switchTab, setFilter, resetFilter, goPage, openModal, _submitModal, deleteOrder };
})();

window.OrderModule = OrderModule;
