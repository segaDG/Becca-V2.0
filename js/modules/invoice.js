   BECCA V2.0 — Invoice Module
============================================ */
const InvoiceModule = (() => {
  let _invoices = [];
  let _filter   = { status: '', search: '' };

  async function init() {
    const page = document.getElementById('page-invoice');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Invoice</h2>
          <p>Manajemen invoice dan tagihan</p>
        </div>
        <div class="page-header-right">
          ${Auth.can('invoice','edit') ? `
            <button class="btn btn-primary" onclick="InvoiceModule.openModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Buat Invoice
            </button>
          ` : ''}
        </div>
      </div>
      <div id="invoice-content"></div>
    `;
    _invoices = await DB.getInvoices().catch(() => []);
    render();
  }

  function render() {
    let data = [..._invoices].sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
    if (_filter.status) data = data.filter(i => i.status === _filter.status);
    if (_filter.search) data = data.filter(i =>
      (i.customer||'').toLowerCase().includes(_filter.search.toLowerCase()) ||
      (i.noinv||'').toLowerCase().includes(_filter.search.toLowerCase())
    );

    const totalTagihan = data.reduce((s,r) => s + (r.total||0), 0);
    const totalLunas   = data.filter(r=>r.status==='LUNAS').reduce((s,r) => s + (r.total||0), 0);
    const totalBelum   = data.filter(r=>r.status!=='LUNAS').reduce((s,r) => s + (r.total||0), 0);

    document.getElementById('invoice-content').innerHTML = `
      <!-- Stats -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          { l:'Total Tagihan', v: Utils.formatRupiah(totalTagihan,true), c:'var(--text-1)' },
          { l:'Sudah Lunas',   v: Utils.formatRupiah(totalLunas,true),   c:'var(--success)' },
          { l:'Belum Lunas',   v: Utils.formatRupiah(totalBelum,true),   c:'var(--danger)' },
          { l:'Total Invoice', v: data.length + ' invoice',              c:'var(--primary-h)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:16px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>

      <!-- Filter -->
      <div class="filter-bar">
        <input type="text" class="form-control" placeholder="Cari customer / no invoice..."
               style="width:220px" oninput="InvoiceModule.setFilter('search',this.value)" value="${_filter.search}">
        <select class="form-control" style="width:130px" onchange="InvoiceModule.setFilter('status',this.value)">
          <option value="">Semua Status</option>
          <option value="LUNAS"  ${_filter.status==='LUNAS' ?'selected':''}>✅ Lunas</option>
          <option value="BELUM"  ${_filter.status==='BELUM' ?'selected':''}>⏳ Belum Lunas</option>
          <option value="PARTIAL"${_filter.status==='PARTIAL'?'selected':''}>🔸 Partial</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="InvoiceModule.resetFilter()">↺ Reset</button>
        <span class="text-muted text-small" style="margin-left:auto">${data.length} invoice</span>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th><th>No Invoice</th><th>Tanggal</th><th>Customer</th>
              <th class="num">Total</th><th class="num">Terbayar</th>
              <th class="num">Sisa</th><th>Status</th><th>Jatuh Tempo</th>
              ${Auth.can('invoice','edit') ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${data.length ? data.map((inv,i) => {
              const sisa = (inv.total||0) - (inv.terbayar||0);
              const isLate = inv.jatuhTempo && inv.status !== 'LUNAS' && inv.jatuhTempo < new Date().toISOString().split('T')[0];
              return `
                <tr ${isLate ? 'style="background:rgba(239,68,68,0.05)"' : ''}>
                  <td class="text-muted">${i+1}</td>
                  <td class="font-semibold font-mono">${inv.noinv||'-'}</td>
                  <td style="white-space:nowrap">${inv.tgl ? Utils.formatDate(inv.tgl,'dd/mm/yyyy') : '-'}</td>
                  <td>${inv.customer||'-'}</td>
                  <td class="num">${Utils.formatRupiah(inv.total||0)}</td>
                  <td class="num" style="color:var(--success)">${inv.terbayar ? Utils.formatRupiah(inv.terbayar) : '-'}</td>
                  <td class="num" style="color:${sisa>0?'var(--danger)':'var(--success)'}">${sisa > 0 ? Utils.formatRupiah(sisa) : '✓'}</td>
                  <td>
                    <span class="badge ${inv.status==='LUNAS'?'badge-success':inv.status==='PARTIAL'?'badge-warning':'badge-danger'}">
                      ${inv.status||'BELUM'}
                    </span>
                  </td>
                  <td class="text-small ${isLate?'text-danger':''}" style="${isLate?'color:var(--danger)':''}" >
                    ${inv.jatuhTempo ? Utils.formatDate(inv.jatuhTempo,'dd/mm/yyyy') : '-'}
                    ${isLate ? ' ⚠️' : ''}
                  </td>
                  ${Auth.can('invoice','edit') ? `
                    <td class="actions">
                      <button class="btn-icon" onclick="InvoiceModule.openModal('${inv.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('') : `
              <tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada invoice</td></tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  function setFilter(key, val) { _filter[key] = val; render(); }
  function resetFilter() { _filter = {}; render(); }

  function openModal(editId = null) {
    const existing = editId ? _invoices.find(i => i.id === editId) : null;
    const d = existing || { tgl: Utils.today ? Utils.today() : new Date().toISOString().split('T')[0], status:'BELUM' };
    const mid = Modal.open({
      title: editId ? 'Edit Invoice' : 'Buat Invoice Baru',
      body: `
        <form id="inv-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">No Invoice <span class="req">*</span></label>
              <input name="noinv" class="form-control" value="${d.noinv||''}" placeholder="INV-2026-001" required>
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal <span class="req">*</span></label>
              <input name="tgl" type="date" class="form-control" value="${d.tgl||''}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Customer <span class="req">*</span></label>
              <input name="customer" class="form-control" value="${d.customer||''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Jatuh Tempo</label>
              <input name="jatuhTempo" type="date" class="form-control" value="${d.jatuhTempo||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Total (Rp) <span class="req">*</span></label>
              <input name="total" type="number" min="0" class="form-control" value="${d.total||0}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Terbayar (Rp)</label>
              <input name="terbayar" type="number" min="0" class="form-control" value="${d.terbayar||0}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="status" class="form-control">
              <option value="BELUM"   ${(d.status||'BELUM')==='BELUM'  ?'selected':''}>⏳ Belum Lunas</option>
              <option value="PARTIAL" ${d.status==='PARTIAL'?'selected':''}>🔸 Partial</option>
              <option value="LUNAS"   ${d.status==='LUNAS'  ?'selected':''}>✅ Lunas</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan</label>
            <input name="ket" class="form-control" value="${d.ket||''}">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="InvoiceModule._submit('${mid}','${editId||''}')">Simpan</button>
      `,
    });
    return mid;
  }

  async function _submit(modalId, editId='') {
    const fd   = new FormData(document.getElementById('inv-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.noinv || !data.customer) { Notify.warning('No Invoice dan Customer wajib diisi'); return; }
    data.total    = parseInt(data.total)    || 0;
    data.terbayar = parseInt(data.terbayar) || 0;
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveInvoice(data);
      const idx   = _invoices.findIndex(i => i.id === saved.id);
      if (idx >= 0) _invoices[idx] = saved; else _invoices.unshift(saved);
      render();
      Modal.close(modalId);
      Notify.success('Invoice disimpan');
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return { init, setFilter, resetFilter, openModal, _submit };
})();
window.InvoiceModule = InvoiceModule;
