/* ============================================
   BECCA V2.0 — Purchase Order / Anggaran Belanja Module
============================================ */
if (typeof window.POModule !== 'undefined') { console.warn('[PO] Already loaded'); }
else { window.POModule = (() => {
  let _data = [];
  let _tab = 'anggaran';
  let _editId = null;
  let _page = 1;
  let _perPage = 20;

  async function init() {
    const page = document.getElementById('page-po');
    if (!page) return;
    try { _data = await DB.getPO(); } catch(e) {
      try { _data = JSON.parse(localStorage.getItem('becca_po_anggaran')||'[]'); } catch { _data = []; }
    }
    _data.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    _render(page);
  }

  function _render(page) {
    if (!page) page = document.getElementById('page-po');
    if (!page) return;
    const canEdit = Auth.can('po','edit');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Purchase Order</h2>
          <p>Estimasi Anggaran Belanja Mingguan</p>
        </div>
        ${canEdit ? `<div class="page-header-right">
          <button class="btn btn-primary" onclick="POModule.addAnggaran()">+ Buat Anggaran</button>
        </div>` : ''}
      </div>
      <div id="po-content"></div>`;
    _renderList();
  }

  function _renderList() {
    const el = document.getElementById('po-content');
    if (!el) return;
    if (!_data.length) {
      el.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-3)"><div style="font-size:32px;margin-bottom:8px">📋</div>Belum ada anggaran</div>';
      return;
    }
    const rp = n => n ? 'Rp '+Math.round(n).toLocaleString('id') : '-';
    el.innerHTML = `
      <div style="display:grid;gap:12px">
        ${_data.map((d,i) => {
          const total = (d.items||[]).reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
          const sisa = Number(d.sisaPeriode)||0;
          return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;cursor:pointer;transition:.15s"
            onclick="POModule.openAnggaran('${d.id}')"
            onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 2px 8px rgba(0,0,0,.08)'"
            onmouseout="this.style.transform='';this.style.boxShadow=''">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div>
                <span style="font-size:12px;font-weight:700;color:var(--primary);font-family:var(--font-mono)">#${d.nomorEstimasi||('EAM'+String(i+1).padStart(3,'0'))}</span>
                <span style="font-size:11px;color:var(--text-3);margin-left:8px">${d.periode||'-'}</span>
              </div>
              <span style="font-size:11px;color:var(--text-3)">${d.namaPetugas||'-'}</span>
            </div>
            <div style="display:flex;gap:16px;font-size:12px">
              <span>Total: <strong style="color:var(--text)">${rp(total + sisa)}</strong></span>
              <span>Items: <strong>${(d.items||[]).filter(it=>it.namaBarang).length}</strong></span>
              ${d.cash ? `<span>Cash: <strong>${rp(d.cash)}</strong></span>` : ''}
              ${d.atm ? `<span>ATM: <strong>${rp(d.atm)}</strong></span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  async function addAnggaran() {
    const today = new Date();
    const nomorEstimasi = 'EAM' + today.getFullYear().toString().slice(-2) + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');
    const cu = typeof Auth!=='undefined' ? Auth.currentUser() : null;
    const doc = {
      id: Utils.uid(),
      nomorEstimasi,
      namaPetugas: cu?.nama || cu?.username || '',
      periode: '',
      tahun: today.getFullYear(),
      items: Array.from({length:20}, () => ({namaBarang:'',qty:0,satuan:'',keterangan:'',harga:0,totalHarga:0,alokasiDanaReal:''})),
      sisaPeriode: 0,
      cash: 0,
      atm: 0,
      sisa: 0,
      createdAt: today.toISOString(),
    };
    try {
      await DB.savePO(doc);
      _data.unshift(doc);
      openAnggaran(doc.id);
    } catch(e) { Notify.error('Gagal membuat anggaran'); }
  }

  function openAnggaran(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    const el = document.getElementById('po-content');
    if (!el) return;
    const rp = n => n ? Math.round(n).toLocaleString('id') : '';
    const items = doc.items || [];
    const total = items.reduce((s,it) => s + (Number(it.totalHarga)||0), 0);

    el.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <button onclick="POModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Kembali</button>
        <button onclick="POModule.printAnggaran('${id}')" style="padding:6px 12px;border:1px solid rgba(99,102,241,.4);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;cursor:pointer;font-weight:600">Print</button>
        <button onclick="POModule.deleteAnggaran('${id}')" style="padding:6px 12px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:rgba(239,68,68,.07);color:#ef4444;font-size:12px;cursor:pointer">Hapus</button>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="form-group"><label class="form-label">Nomor Estimasi</label>
            <input class="form-control" value="${doc.nomorEstimasi||''}" onchange="POModule._saveMeta('${id}','nomorEstimasi',this.value)" style="font-family:var(--font-mono);font-weight:700"></div>
          <div class="form-group"><label class="form-label">Nama Petugas</label>
            <input class="form-control" value="${doc.namaPetugas||''}" onchange="POModule._saveMeta('${id}','namaPetugas',this.value)"></div>
          <div class="form-group"><label class="form-label">Periode</label>
            <input class="form-control" value="${doc.periode||''}" placeholder="2 Apr - 5 Apr" onchange="POModule._saveMeta('${id}','periode',this.value)"></div>
          <div class="form-group"><label class="form-label">Tahun</label>
            <input class="form-control" type="number" value="${doc.tahun||2026}" onchange="POModule._saveMeta('${id}','tahun',+this.value)"></div>
        </div>
      </div>

      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:800px" id="po-table">
          <thead>
            <tr style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff">
              <th style="padding:8px 6px;font-size:9px;font-weight:700;width:30px">#</th>
              <th style="padding:8px 6px;font-size:9px;font-weight:700;text-align:left;min-width:200px">NAMA BARANG</th>
              <th style="padding:8px 6px;font-size:9px;font-weight:700;width:50px">QTY</th>
              <th style="padding:8px 6px;font-size:9px;font-weight:700;width:60px">SATUAN</th>
              <th style="padding:8px 6px;font-size:9px;font-weight:700;text-align:left;min-width:120px">KETERANGAN</th>
              <th style="padding:8px 6px;font-size:9px;font-weight:700;text-align:right;width:100px">HARGA (IDR)</th>
              <th style="padding:8px 6px;font-size:9px;font-weight:700;text-align:right;width:110px">TOTAL HARGA</th>
              <th style="padding:8px 6px;font-size:9px;font-weight:700;text-align:left;min-width:100px">ALOKASI DANA REAL</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it,i) => `
              <tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.015)':''}">
                <td style="padding:4px 6px;text-align:center;color:var(--text-3);font-size:10px">${it.namaBarang?i+1:''}</td>
                <td style="padding:2px 3px"><input value="${(it.namaBarang||'').replace(/"/g,'&quot;')}" data-row="${i}" data-key="namaBarang" onchange="POModule._saveCell('${id}',${i},'namaBarang',this.value)"
                  style="width:100%;border:none;background:transparent;padding:4px 5px;font-size:12px;color:var(--text)" onfocus="this.style.background='rgba(99,102,241,.06)'" onblur="this.style.background='transparent'"></td>
                <td style="padding:2px 3px"><input type="number" min="0" step="1" value="${it.qty||''}" data-row="${i}" data-key="qty" onchange="POModule._saveCell('${id}',${i},'qty',+this.value)"
                  style="width:100%;border:none;background:transparent;padding:4px 5px;font-size:12px;text-align:center;color:var(--text)" onfocus="this.select();this.style.background='rgba(99,102,241,.06)'" onblur="this.style.background='transparent'"></td>
                <td style="padding:2px 3px"><input value="${it.satuan||''}" data-row="${i}" data-key="satuan" onchange="POModule._saveCell('${id}',${i},'satuan',this.value)"
                  style="width:100%;border:none;background:transparent;padding:4px 5px;font-size:12px;text-align:center;color:var(--text)" onfocus="this.style.background='rgba(99,102,241,.06)'" onblur="this.style.background='transparent'"></td>
                <td style="padding:2px 3px"><input value="${(it.keterangan||'').replace(/"/g,'&quot;')}" data-row="${i}" data-key="keterangan" onchange="POModule._saveCell('${id}',${i},'keterangan',this.value)"
                  style="width:100%;border:none;background:transparent;padding:4px 5px;font-size:12px;color:var(--text)" onfocus="this.style.background='rgba(99,102,241,.06)'" onblur="this.style.background='transparent'"></td>
                <td style="padding:2px 3px"><input type="number" min="0" step="1" value="${it.harga||''}" data-row="${i}" data-key="harga" onchange="POModule._saveCell('${id}',${i},'harga',+this.value)"
                  style="width:100%;border:none;background:transparent;padding:4px 5px;font-size:12px;text-align:right;font-family:var(--font-mono);color:var(--text)" onfocus="this.select();this.style.background='rgba(99,102,241,.06)'" onblur="this.style.background='transparent'"></td>
                <td style="padding:6px;text-align:right;font-family:var(--font-mono);font-weight:600;color:${it.totalHarga?'var(--text)':'var(--text-3)'}">${it.totalHarga?rp(it.totalHarga):'-'}</td>
                <td style="padding:2px 3px"><input value="${(it.alokasiDanaReal||'').replace(/"/g,'&quot;')}" data-row="${i}" data-key="alokasiDanaReal" onchange="POModule._saveCell('${id}',${i},'alokasiDanaReal',this.value)"
                  style="width:100%;border:none;background:transparent;padding:4px 5px;font-size:12px;color:var(--text)" onfocus="this.style.background='rgba(99,102,241,.06)'" onblur="this.style.background='transparent'"></td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface2);border-top:2px solid var(--border)">
              <td colspan="5" style="padding:6px;text-align:right;font-size:10px;color:var(--text-3)">Sisa periode sebelumnya</td>
              <td colspan="2" style="padding:6px;text-align:right;font-family:var(--font-mono)">
                <input type="number" min="0" step="1" value="${doc.sisaPeriode||0}" onchange="POModule._saveMeta('${id}','sisaPeriode',+this.value);POModule.openAnggaran('${id}')"
                  style="width:100px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:12px;background:var(--surface)">
              </td><td></td>
            </tr>
            <tr style="background:rgba(220,38,38,.08);font-weight:700">
              <td colspan="5" style="padding:8px;text-align:right;font-size:12px;color:#dc2626">Total</td>
              <td colspan="2" style="padding:8px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#dc2626">${rp(total + (Number(doc.sisaPeriode)||0))}</td>
              <td></td>
            </tr>
            <tr style="background:var(--surface2)">
              <td colspan="5"></td>
              <td style="padding:4px 6px;text-align:right;font-size:11px;color:var(--text-3)">Cash</td>
              <td style="padding:4px 6px"><input type="number" min="0" step="1" value="${doc.cash||0}" onchange="POModule._saveMeta('${id}','cash',+this.value)"
                style="width:100px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)"></td><td></td>
            </tr>
            <tr style="background:var(--surface2)">
              <td colspan="5"></td>
              <td style="padding:4px 6px;text-align:right;font-size:11px;color:var(--text-3)">ATM</td>
              <td style="padding:4px 6px"><input type="number" min="0" step="1" value="${doc.atm||0}" onchange="POModule._saveMeta('${id}','atm',+this.value)"
                style="width:100px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)"></td><td></td>
            </tr>
            <tr style="background:var(--surface2)">
              <td colspan="5"></td>
              <td style="padding:4px 6px;text-align:right;font-size:11px;font-weight:700;color:var(--text)">SISA</td>
              <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:700;color:${(Number(doc.cash||0)+Number(doc.atm||0)-total-(Number(doc.sisaPeriode)||0))>=0?'#10b981':'#ef4444'}">${rp(Math.abs(Number(doc.cash||0)+Number(doc.atm||0)-total-(Number(doc.sisaPeriode)||0)))}</td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="margin-top:8px;text-align:right">
        <button onclick="POModule._addRows('${id}')" style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text-3);font-size:11px;cursor:pointer">+ Tambah 10 Baris</button>
      </div>`;
  }

  async function _saveCell(docId, rowIdx, key, val) {
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    doc.items[rowIdx][key] = val;
    if (key === 'qty' || key === 'harga') {
      doc.items[rowIdx].totalHarga = (Number(doc.items[rowIdx].qty)||0) * (Number(doc.items[rowIdx].harga)||0);
      // Update total cell in DOM
      const totalCells = document.querySelectorAll('#po-table tbody tr');
      if (totalCells[rowIdx]) {
        const tds = totalCells[rowIdx].querySelectorAll('td');
        const totalTd = tds[6];
        if (totalTd) {
          const v = doc.items[rowIdx].totalHarga;
          totalTd.textContent = v ? Math.round(v).toLocaleString('id') : '-';
          totalTd.style.color = v ? 'var(--text)' : 'var(--text-3)';
        }
      }
    }
    DB.savePO(doc).catch(() => {});
  }

  async function _saveMeta(docId, key, val) {
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    doc[key] = val;
    DB.savePO(doc).catch(() => {});
  }

  function _addRows(docId) {
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    for (let i = 0; i < 10; i++) doc.items.push({namaBarang:'',qty:0,satuan:'',keterangan:'',harga:0,totalHarga:0,alokasiDanaReal:''});
    DB.savePO(doc).catch(() => {});
    openAnggaran(docId);
  }

  function backToList() { _renderList(); }

  async function deleteAnggaran(id) {
    const ok = await Modal.confirm({title:'Hapus Anggaran',message:'Anggaran ini akan dihapus permanen.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    _data = _data.filter(d => d.id !== id);
    try { await DB.deletePO(id); } catch(e) {}
    _renderList();
    Notify.success('Anggaran dihapus');
  }

  function printAnggaran(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    const items = doc.items || [];
    const rp = n => n ? Math.round(n).toLocaleString('id') + ',-' : '0,-';
    const total = items.reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
    const sisa = Number(doc.sisaPeriode)||0;
    const rows = items.map((it,i) => `
      <tr style="border-bottom:1px solid #eee;${i%2?'background:#f9f9f9':''}">
        <td style="padding:4px 8px;font-size:10px;border-left:1px solid #ddd">${it.namaBarang||''}</td>
        <td style="padding:4px 6px;text-align:center;font-size:10px">${it.qty||''}</td>
        <td style="padding:4px 6px;text-align:center;font-size:10px">${it.satuan||''}</td>
        <td style="padding:4px 6px;font-size:10px">${it.keterangan||''}</td>
        <td style="padding:4px 6px;text-align:right;font-size:10px">${it.harga?rp(it.harga):''}</td>
        <td style="padding:4px 6px;text-align:right;font-size:10px;font-weight:600">${it.totalHarga?rp(it.totalHarga):''}</td>
        <td style="padding:4px 6px;font-size:10px;border-right:1px solid #ddd">${it.alokasiDanaReal||''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Anggaran ${doc.nomorEstimasi}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:16px}
    @page{size:A4 portrait;margin:10mm}@media print{.no-print{display:none!important}}
    table{width:100%;border-collapse:collapse}</style></head><body>
    <button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 20px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;z-index:99">Print</button>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <div style="font-size:11px;font-weight:700;color:#dc2626;background:#fef2f2;display:inline-block;padding:2px 8px;border-radius:3px">BPS</div>
        <div style="font-size:22px;font-weight:900;color:#1a1a2e;margin-top:4px">Estimasi Anggaran Mingguan</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;color:#666;background:#f5f5f5;padding:3px 8px;border-radius:3px">Estimation Number #${doc.nomorEstimasi||''}</div>
        <div style="font-size:10px;margin-top:4px"><span style="color:#666">Nama Petugas:</span> <strong style="font-size:18px;color:#dc2626">${doc.namaPetugas||''}</strong></div>
      </div>
    </div>
    <div style="font-size:10px;color:#666;margin-bottom:8px;padding:6px 10px;background:#fafafa;border:1px solid #eee;border-radius:4px">
      <strong>Tujuan</strong><br>Lembaran estimasi anggaran ini di buat untuk menghitung anggaran yang akan dikeluarkan untuk keperluan operasional dan gaji pada periode yang bersangkutan.
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px;font-size:11px">
      <span style="color:#dc2626;font-weight:700">Periode ${doc.tahun||''}</span>
      <span style="font-weight:700">${doc.periode||''}</span>
    </div>
    <table>
      <thead><tr style="background:#dc2626;color:#fff">
        <th style="padding:6px;font-size:9px;text-align:left">Nama barang</th>
        <th style="padding:6px;font-size:9px;width:40px">QTY</th>
        <th style="padding:6px;font-size:9px;width:50px">Satuan</th>
        <th style="padding:6px;font-size:9px;text-align:left">Keterangan</th>
        <th style="padding:6px;font-size:9px;text-align:right;width:90px">Harga (IDR)</th>
        <th style="padding:6px;font-size:9px;text-align:right;width:100px">Total Harga (IDR)</th>
        <th style="padding:6px;font-size:9px;text-align:left;width:100px">Alokasi Dana Real</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="border-top:1px solid #ddd"><td colspan="4"></td><td style="padding:4px 6px;text-align:right;font-size:10px;color:#666">Sisa periode sebelumnya</td><td style="padding:4px 6px;text-align:right;font-size:10px">${rp(sisa)}</td><td></td></tr>
        <tr style="background:#fef2f2;font-weight:700"><td colspan="4"></td><td style="padding:6px;text-align:right;color:#dc2626">Total</td><td style="padding:6px;text-align:right;font-size:12px;color:#dc2626">${rp(total+sisa)}</td><td></td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px">Cash ${rp(doc.cash||0)}</td><td></td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px">ATM. ${rp(doc.atm||0)}</td><td></td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px;font-weight:700">SISA ${rp(Math.abs((doc.cash||0)+(doc.atm||0)-total-sisa))}</td><td></td></tr>
      </tfoot>
    </table>
    </body></html>`;
    const w = window.open('','_blank','width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); }
  }

  return { init, addAnggaran, openAnggaran, backToList, deleteAnggaran, printAnggaran, _saveCell, _saveMeta, _addRows };
})(); }
