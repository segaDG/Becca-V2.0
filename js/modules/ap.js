/* ============================================
   BECCA V2.0 — Account Payable Module
============================================ */
const APModule = (() => {
  let _ap = [];
  let _suppliers = [];

  async function init() {
    const page = document.getElementById('page-ap');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Account Payable</h2>
          <p>Manajemen hutang dan tagihan dari supplier</p>
        </div>
        <div class="page-header-right">
          ${Auth.can('ap','edit') ? `
            <button class="btn btn-ghost" onclick="APModule.openSupplierModal()">Kelola Supplier</button>
            <button class="btn btn-primary" onclick="APModule.openModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Tambah AP
            </button>
          ` : ''}
        </div>
      </div>
      <div id="ap-content"></div>
    `;
    [_ap, _suppliers] = await Promise.all([DB.getAP().catch(()=>[]), DB.getSuppliers().catch(()=>[])]);
    render();
  }

  function render() {
    const sorted = [..._ap].sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
    const totalHutang = _ap.filter(r=>r.status!=='LUNAS').reduce((s,r) => s+(r.total||0),0);
    const totalLunas  = _ap.filter(r=>r.status==='LUNAS').reduce((s,r) => s+(r.total||0),0);

    document.getElementById('ap-content').innerHTML = `
      <!-- Stats -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          { l:'Total Hutang', v: Utils.formatRupiah(totalHutang,true), c:'var(--danger)' },
          { l:'Sudah Dibayar',v: Utils.formatRupiah(totalLunas,true),  c:'var(--success)' },
          { l:'Total AP',     v: sorted.length + ' tagihan',           c:'var(--primary-h)' },
          { l:'Supplier',     v: _suppliers.length + ' supplier',      c:'var(--text-2)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:16px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>

      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th><th>Tanggal</th><th>Supplier</th><th>Keterangan</th>
              <th class="num">Total</th><th class="num">Terbayar</th><th class="num">Sisa</th>
              <th>Jatuh Tempo</th><th>Status</th>
              ${Auth.can('ap','edit') ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${sorted.length ? sorted.map((r,i) => {
              const sisa = (r.total||0) - (r.terbayar||0);
              const late = r.jatuhTempo && r.status!=='LUNAS' && r.jatuhTempo < new Date().toISOString().split('T')[0];
              return `
                <tr ${late?'style="background:rgba(239,68,68,0.05)"':''}>
                  <td class="text-muted">${i+1}</td>
                  <td style="white-space:nowrap">${r.tgl ? Utils.formatDate(r.tgl,'dd/mm/yyyy') : '-'}</td>
                  <td class="font-semibold">${r.supplier||'-'}</td>
                  <td class="text-muted text-small">${r.ket||'-'}</td>
                  <td class="num">${Utils.formatRupiah(r.total||0)}</td>
                  <td class="num" style="color:var(--success)">${r.terbayar ? Utils.formatRupiah(r.terbayar) : '-'}</td>
                  <td class="num" style="color:${sisa>0?'var(--danger)':'var(--success)'}">${sisa>0?Utils.formatRupiah(sisa):'✓ Lunas'}</td>
                  <td class="text-small ${late?'':''}">
                    ${r.jatuhTempo ? Utils.formatDate(r.jatuhTempo,'dd/mm/yyyy') : '-'}
                    ${late?' ⚠️':''}
                  </td>
                  <td>
                    <span class="badge ${r.status==='LUNAS'?'badge-success':r.status==='PARTIAL'?'badge-warning':'badge-danger'}">
                      ${r.status||'BELUM'}
                    </span>
                  </td>
                  ${Auth.can('ap','edit') ? `
                    <td><button class="btn-icon" onclick="APModule.openModal('${r.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button></td>
                  ` : ''}
                </tr>
              `;
            }).join('') : `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada data AP</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function openModal(editId = null) {
    const existing = editId ? _ap.find(r => r.id === editId) : null;
    const d = existing || { tgl: Utils.today ? Utils.today() : '', status: 'BELUM' };
    const suppOpts = _suppliers.map(s => `<option value="${s.nama}" ${d.supplier===s.nama?'selected':''}>${s.nama}</option>`).join('');
    const mid = Modal.open({
      title: editId ? 'Edit AP' : 'Tambah Account Payable',
      body: `
        <form id="ap-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal</label>
              <input name="tgl" type="date" class="form-control" value="${d.tgl||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Jatuh Tempo</label>
              <input name="jatuhTempo" type="date" class="form-control" value="${d.jatuhTempo||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Supplier <span class="req">*</span></label>
            <input name="supplier" class="form-control" list="sup-list" value="${d.supplier||''}" required>
            <datalist id="sup-list">${suppOpts}</datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan</label>
            <input name="ket" class="form-control" value="${d.ket||''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Total (Rp)</label>
              <input name="total" type="number" min="0" class="form-control" value="${d.total||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Terbayar (Rp)</label>
              <input name="terbayar" type="number" min="0" class="form-control" value="${d.terbayar||0}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="status" class="form-control">
              <option value="BELUM"   ${(d.status||'BELUM')==='BELUM'  ?'selected':''}>⏳ Belum</option>
              <option value="PARTIAL" ${d.status==='PARTIAL'?'selected':''}>🔸 Partial</option>
              <option value="LUNAS"   ${d.status==='LUNAS'  ?'selected':''}>✅ Lunas</option>
            </select>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="APModule._submit('${mid}','${editId||''}')">Simpan</button>
      `,
    });
    return mid;
  }

  function openSupplierModal() {
    const mid = Modal.open({
      title: 'Kelola Supplier',
      body: `
        <div id="sup-list-wrap">
          ${_suppliers.map(s => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span>${s.nama}</span>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="APModule._deleteSupplier('${s.id}')">Hapus</button>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:var(--s4);display:flex;gap:var(--s2)">
          <input id="new-sup-name" class="form-control" placeholder="Nama supplier baru">
          <button class="btn btn-primary btn-sm" onclick="APModule._addSupplier()">Tambah</button>
        </div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
    return mid;
  }

  async function _addSupplier() {
    const nama = document.getElementById('new-sup-name').value.trim();
    if (!nama) return;
    const saved = await DB.saveSupplier({ nama });
    _suppliers.push(saved);
    document.getElementById('sup-list-wrap').innerHTML += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <span>${saved.nama}</span>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="APModule._deleteSupplier('${saved.id}')">Hapus</button>
      </div>
    `;
    document.getElementById('new-sup-name').value = '';
  }

  async function _deleteSupplier(id) {
    await DB.delete('suppliers', id);
    _suppliers = _suppliers.filter(s => s.id !== id);
    render();
  }

  async function _submit(modalId, editId='') {
    const fd   = new FormData(document.getElementById('ap-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.supplier) { Notify.warning('Supplier wajib diisi'); return; }
    data.total    = parseInt(data.total)    || 0;
    data.terbayar = parseInt(data.terbayar) || 0;
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveAP(data);
      const idx   = _ap.findIndex(r => r.id === saved.id);
      if (idx >= 0) _ap[idx] = saved; else _ap.unshift(saved);
      render();
      Modal.close(modalId);
      Notify.success('AP disimpan');
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return { init, openModal, openSupplierModal, _submit, _addSupplier, _deleteSupplier };
})();
window.APModule = APModule;
