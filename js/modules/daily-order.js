/* ============================================
   BECCA V2.0 — Daily Order Module v1
   Form Produksi, Data Analysis, Cek Selisih, Summary
============================================ */
const DailyOrderModule = (() => {
  let _view  = 'form';
  let _forms = [];
  let _orders= [];
  let _date  = new Date().toISOString().slice(0,10);
  let _shift = 'S1';
  let _summaryMonth = new Date().toISOString().slice(0,7); // YYYY-MM
  let _editingItemId = null; // null | 'new' | existing item id
  let _inventory     = [];

  const _SATS = ['Kg','Pcs','Liter','Pack','Bal','Ikat','Bks','Lusin','Karton','Gram','ML'];

  /* ─── HELPERS ─── */
  function _today() { return new Date().toISOString().slice(0,10); }

  function _fmtDate(s) {
    if (!s) return '-';
    try { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}); }
    catch { return s; }
  }

  function _fmtRp(n) {
    if (!n) return '-';
    return 'Rp\u00a0' + Number(n).toLocaleString('id-ID');
  }

  function _n(v) { return Number(v) || 0; }

  function _currentForm() {
    return _forms.find(f => f.tanggal === _date && f.shift === _shift) || null;
  }

  /* Hitung ringkasan order per customer untuk tanggal+shift tertentu */
  function _getOrderSummary(date, shift) {
    const dayOrds = _orders.filter(o => o.tglOrder === date);
    const out = [];
    dayOrds.forEach(o => {
      let meals = 0, snacks = 0;
      if (shift === 'S1') {
        meals  = _n(o.breakfast) + _n(o.shift1) + _n(o.spare1) + _n(o.ot1);
        snacks = _n(o.snack1);
      } else {
        meals  = _n(o.shift2) + _n(o.spare2) + _n(o.ot2) + _n(o.shift3) + _n(o.spare3) + _n(o.ot3);
        snacks = _n(o.snack2) + _n(o.snack3);
      }
      if (meals + snacks > 0) out.push({ nama: o.namaPerusahaan, meals, snacks, total: meals + snacks });
    });
    return out.sort((a,b) => b.total - a.total);
  }

  function _totalPortions(date, shift) {
    return _getOrderSummary(date, shift).reduce((s,c) => s + c.total, 0);
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-daily-order');
    if (!page) return;
    try {
      const [forms, orders, inv] = await Promise.all([
        DB.getDailyOrderForms().catch(() => []),
        DB.getOrders().catch(() => []),
        DB.getInventory().catch(() => []),
      ]);
      _forms     = Array.isArray(forms)  ? forms  : [];
      _orders    = Array.isArray(orders) ? orders : [];
      _inventory = Array.isArray(inv)    ? inv    : [];
    } catch {
      _forms = []; _orders = [];
    }
    _date = _today();
    _renderFull(page);
  }

  /* ─── RENDER FULL ─── */
  function _renderFull(page) {
    page.innerHTML = `
      <div style="padding:var(--s4) var(--s6)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--s4)">
          <div>
            <div style="font-size:18px;font-weight:700;color:var(--text)">Daily Order</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px">Manajemen Produksi Harian Catering</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:var(--s4)">
          ${[
            {id:'form',     label:'📋 Form Produksi'},
            {id:'analysis', label:'📊 Data Analysis'},
            {id:'selisih',  label:'⚖️ Cek Selisih'},
            {id:'summary',  label:'📅 Summary'},
          ].map(t => `
            <button onclick="DailyOrderModule.setView('${t.id}')"
              style="flex:1;padding:8px 4px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;
                background:${_view===t.id?'var(--primary)':'transparent'};
                color:${_view===t.id?'#fff':'var(--text-2)'}">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <div id="do-content"></div>
      </div>`;
    _renderContent();
  }

  function _renderContent() {
    const el = document.getElementById('do-content');
    if (!el) return;
    switch(_view) {
      case 'form':     el.innerHTML = _htmlFormProduksi(); break;
      case 'analysis': el.innerHTML = _htmlDataAnalysis(); break;
      case 'selisih':  el.innerHTML = _htmlCekSelisih();   break;
      case 'summary':  el.innerHTML = _htmlSummary();      break;
    }
  }

  /* ─── FORM PRODUKSI ─── */
  function _htmlFormProduksi() {
    const summary      = _getOrderSummary(_date, _shift);
    const totalPortions= summary.reduce((s,c) => s + c.total, 0);
    const form         = _currentForm();
    const items        = form ? (form.items || []) : [];
    const totalEst     = items.reduce((s,it) => s + _n(it.estTotal), 0);
    const totalAkt     = items.reduce((s,it) => s + _n(it.aktTotal), 0);
    const budgetOk     = !form?.budgetBelanja || totalEst <= _n(form.budgetBelanja);

    return `
      <!-- Selector tanggal & shift -->
      <div style="display:flex;gap:var(--s3);align-items:flex-end;flex-wrap:wrap;margin-bottom:var(--s4)">
        <div>
          <label style="font-size:11px;color:var(--text-3);font-weight:600;display:block;margin-bottom:4px">TANGGAL</label>
          <input type="date" value="${_date}" onchange="DailyOrderModule.setDate(this.value)"
            style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-3);font-weight:600;display:block;margin-bottom:4px">SHIFT</label>
          <div style="display:flex;gap:4px">
            ${['S1','S2'].map(s => `
              <button onclick="DailyOrderModule.setShift('${s}')"
                style="padding:8px 18px;border:1px solid ${_shift===s?'var(--primary)':'var(--border)'};border-radius:8px;
                  background:${_shift===s?'rgba(99,102,241,.12)':'var(--surface)'};
                  color:${_shift===s?'var(--primary)':'var(--text-2)'};
                  font-weight:${_shift===s?'700':'400'};font-size:13px;cursor:pointer">
                ${s==='S1'?'Shift 1':'Shift 2 &amp; 3'}
              </button>
            `).join('')}
          </div>
        </div>
        ${form ? `
          <div style="margin-left:auto;align-self:center">
            <span style="font-size:11px;padding:4px 12px;border-radius:20px;font-weight:700;
              background:${form.status==='final'?'rgba(16,185,129,.12)':'rgba(245,158,11,.12)'};
              color:${form.status==='final'?'#10b981':'#f59e0b'}">
              ${form.status==='final'?'✓ Final':'● Draft'}
            </span>
          </div>
        ` : ''}
      </div>

      <!-- Ringkasan orderan -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4);margin-bottom:var(--s4)">
        <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.05em;margin-bottom:10px">
          RINGKASAN ORDER — ${_fmtDate(_date)} / ${_shift==='S1'?'Shift 1':'Shift 2&amp;3'}
        </div>
        ${summary.length===0
          ? `<div style="text-align:center;padding:16px;color:var(--text-3);font-size:13px">Tidak ada order untuk tanggal ini</div>`
          : `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
              ${summary.map(c => `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;min-width:90px">
                  <div style="font-size:10px;color:var(--text-3);font-weight:600;white-space:nowrap">${c.nama}</div>
                  <div style="font-size:16px;font-weight:700;color:var(--text)">${c.total.toLocaleString('id-ID')}</div>
                  <div style="font-size:10px;color:var(--text-3)">${c.meals?c.meals+' meal':''} ${c.snacks?c.snacks+' snack':''}</div>
                </div>
              `).join('')}
            </div>
            <div style="font-weight:700;color:var(--primary);font-size:14px">Total: ${totalPortions.toLocaleString('id-ID')} porsi</div>`
        }
      </div>

      <!-- Budget bar -->
      ${form && _n(form.budgetBelanja) ? `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4);margin-bottom:var(--s4)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:11px;font-weight:700;color:var(--text-3)">BUDGET HARIAN</span>
            <span style="font-size:12px;font-weight:700;color:${budgetOk?'#10b981':'#ef4444'}">
              ${budgetOk?'✓ Aman':'⚠ Over Budget'}
            </span>
          </div>
          <div style="background:var(--surface2);height:6px;border-radius:3px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${Math.min(100,(totalEst/_n(form.budgetBelanja)*100)).toFixed(1)}%;
              background:${budgetOk?'#10b981':'#ef4444'};border-radius:3px;transition:width .3s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3)">
            <span>Est: <strong style="color:var(--text)">${_fmtRp(totalEst)}</strong></span>
            <span>Budget: <strong style="color:var(--text)">${_fmtRp(form.budgetBelanja)}</strong></span>
            <span>${(_n(totalEst)/_n(form.budgetBelanja)*100).toFixed(1)}%</span>
          </div>
        </div>
      ` : ''}

      <!-- Form produksi table -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:var(--s3) var(--s4);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <span style="font-size:13px;font-weight:700">Form Produksi</span>
            <span style="font-size:11px;color:var(--text-3);margin-left:8px">${items.length} bahan</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${form ? `
              <button onclick="DailyOrderModule.startAddItem()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer;font-weight:600">+ Tambah Bahan</button>
              <button onclick="DailyOrderModule.openBudget()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">💰 Budget</button>
              <button onclick="DailyOrderModule.toggleStatus()" style="padding:6px 12px;border:1px solid ${form.status==='final'?'rgba(245,158,11,.4)':'rgba(16,185,129,.4)'};border-radius:7px;
                background:${form.status==='final'?'rgba(245,158,11,.08)':'rgba(16,185,129,.08)'};
                color:${form.status==='final'?'#f59e0b':'#10b981'};font-size:12px;cursor:pointer;font-weight:600">
                ${form.status==='final'?'↺ Buka Draft':'✓ Finalisasi'}
              </button>
              <button onclick="DailyOrderModule.deleteForm()" style="padding:6px 12px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:rgba(239,68,68,.07);color:#ef4444;font-size:12px;cursor:pointer">Hapus</button>
            ` : `
              <button onclick="DailyOrderModule.createForm()" style="padding:6px 16px;border:none;border-radius:7px;background:var(--primary);color:#fff;font-size:12px;cursor:pointer;font-weight:600">+ Buat Form Produksi</button>
            `}
          </div>
        </div>

        ${!form
          ? `<div style="padding:48px;text-align:center;color:var(--text-3)">
               <div style="font-size:36px;margin-bottom:10px">📋</div>
               <div style="font-size:14px;font-weight:600;margin-bottom:4px">Belum ada form produksi</div>
               <div style="font-size:12px">Klik "+ Buat Form Produksi" untuk memulai</div>
             </div>`
          : `<div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:700px">
                <thead>
                  <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
                    <th style="padding:7px 5px;text-align:center;color:var(--text-3);font-weight:600;width:30px">#</th>
                    <th style="padding:7px 5px;text-align:left;color:var(--text-3);font-weight:600;min-width:140px">ITEM / BAHAN</th>
                    <th style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:600">EST QTY</th>
                    <th style="padding:7px 5px;text-align:center;color:var(--text-3);font-weight:600">SAT</th>
                    <th style="padding:7px 5px;text-align:right;color:var(--text-3);font-weight:600;white-space:nowrap">HARGA @</th>
                    <th style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:600;white-space:nowrap">EST TOTAL</th>
                    <th style="padding:7px 5px;text-align:right;color:#10b981;font-weight:600">AKT QTY</th>
                    <th style="padding:7px 5px;text-align:right;color:#10b981;font-weight:600;white-space:nowrap">AKT TOTAL</th>
                    <th style="padding:7px 5px;text-align:center;color:var(--text-3);font-weight:600">SUMBER</th>
                    <th style="padding:7px 5px;text-align:left;color:var(--text-3);font-weight:600">CATATAN</th>
                    <th style="padding:7px 5px;width:50px"></th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length===0 && _editingItemId !== 'new'
                    ? `<tr><td colspan="11" style="padding:28px;text-align:center;color:var(--text-3)">
                        <span style="font-size:20px">📦</span>
                        <div style="margin-top:8px;font-size:13px;font-weight:600">Belum ada bahan ditambahkan</div>
                        <div style="font-size:11px;margin-top:2px">Klik "+ Tambah Bahan" untuk menambah bahan produksi</div>
                       </td></tr>`
                    : items.map((it,i) => it.id === _editingItemId ? _htmlEditRow(it,i) : _htmlItemRow(it,i)).join('') +
                      (_editingItemId === 'new' ? _htmlEditRow(null, items.length) : '')
                  }
                </tbody>
                ${items.length > 0 ? `
                <tfoot>
                  <tr style="background:var(--surface2);border-top:2px solid var(--border);font-weight:700">
                    <td colspan="5" style="padding:9px 5px;text-align:right;color:var(--text-3);font-size:10px;letter-spacing:.03em">TOTAL ESTIMASI</td>
                    <td style="padding:9px 5px;text-align:right;color:#6366f1">${totalEst.toLocaleString('id-ID')}</td>
                    <td style="padding:9px 5px;text-align:right;color:var(--text-3);font-size:10px">AKTUAL</td>
                    <td style="padding:9px 5px;text-align:right;color:#10b981">${totalAkt.toLocaleString('id-ID')}</td>
                    <td colspan="3" style="padding:9px 5px"></td>
                  </tr>
                </tfoot>` : ''}
              </table>
            </div>`
        }
      </div>`;
  }

  /* ─── DATA ANALYSIS ─── */
  function _htmlDataAnalysis() {
    const itemMap = {};
    _forms.forEach(f => {
      (f.items||[]).forEach(it => {
        if (!itemMap[it.item]) itemMap[it.item] = {item:it.item, satuan:it.satuan, totalQty:0, totalValue:0, days:0};
        itemMap[it.item].totalQty   += _n(it.aktQty)   || _n(it.estQty);
        itemMap[it.item].totalValue += _n(it.aktTotal)  || _n(it.estTotal);
        itemMap[it.item].days++;
      });
    });
    const items      = Object.values(itemMap).sort((a,b) => b.totalValue - a.totalValue);
    const grandTotal = items.reduce((s,it) => s + it.totalValue, 0);
    const totalForms = _forms.length;
    const activeDays = new Set(_forms.map(f=>f.tanggal)).size;

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${[
          {label:'Total Form',    value:totalForms,             unit:'form',  color:'#6366f1'},
          {label:'Hari Aktif',    value:activeDays,             unit:'hari',  color:'#10b981'},
          {label:'Total Item',    value:items.length,           unit:'bahan', color:'#8b5cf6'},
          {label:'Total Nilai',   value:_fmtRp(grandTotal),     unit:'',      color:'#f59e0b'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4)">
            <div style="font-size:11px;color:var(--text-3);font-weight:600">${s.label}</div>
            <div style="font-size:20px;font-weight:700;color:${s.color};margin-top:4px">${s.value}</div>
            ${s.unit?`<div style="font-size:11px;color:var(--text-3)">${s.unit}</div>`:''}
          </div>
        `).join('')}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:var(--s4);border-bottom:1px solid var(--border)">
          <span style="font-size:13px;font-weight:700">Penggunaan Bahan Terbesar</span>
          <span style="font-size:11px;color:var(--text-3);margin-left:8px">${items.length} item</span>
        </div>
        ${items.length===0
          ? `<div style="padding:48px;text-align:center;color:var(--text-3)">Belum ada data form produksi</div>`
          : `<div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                  <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                    <th style="padding:8px;text-align:center;color:var(--text-3);width:36px">#</th>
                    <th style="padding:8px;text-align:left;color:var(--text-3)">ITEM</th>
                    <th style="padding:8px;text-align:right;color:var(--primary)">TOTAL QTY</th>
                    <th style="padding:8px;text-align:center;color:var(--text-3)">SAT</th>
                    <th style="padding:8px;text-align:right;color:var(--text-3)">TOTAL NILAI</th>
                    <th style="padding:8px;text-align:right;color:var(--text-3)" style="min-width:120px">% DARI TOTAL</th>
                    <th style="padding:8px;text-align:center;color:var(--text-3)">FORM</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((it,i) => {
                    const pct = grandTotal > 0 ? (it.totalValue/grandTotal*100).toFixed(1) : 0;
                    return `
                    <tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.018)':''}">
                      <td style="padding:8px;text-align:center;color:var(--text-3)">${i+1}</td>
                      <td style="padding:8px;font-weight:600">${it.item}</td>
                      <td style="padding:8px;text-align:right;font-weight:700;color:var(--primary)">${it.totalQty.toLocaleString('id-ID',{maximumFractionDigits:2})}</td>
                      <td style="padding:8px;text-align:center;color:var(--text-3)">${it.satuan||'-'}</td>
                      <td style="padding:8px;text-align:right">${it.totalValue.toLocaleString('id-ID')}</td>
                      <td style="padding:8px">
                        <div style="display:flex;align-items:center;gap:6px">
                          <div style="flex:1;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px"></div>
                          </div>
                          <span style="color:var(--text-3);font-size:11px;width:38px;text-align:right">${pct}%</span>
                        </div>
                      </td>
                      <td style="padding:8px;text-align:center;color:var(--text-3)">${it.days}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>`;
  }

  /* ─── CEK SELISIH ─── */
  function _htmlCekSelisih() {
    const itemMap = {};
    _forms.forEach(f => {
      (f.items||[]).forEach(it => {
        if (!itemMap[it.item]) itemMap[it.item] = {item:it.item, satuan:it.satuan, harga:_n(it.hargaSatuan), totalEst:0, totalAkt:0};
        itemMap[it.item].totalEst += _n(it.estQty);
        itemMap[it.item].totalAkt += _n(it.aktQty);
      });
    });
    const rows = Object.values(itemMap).map(it => ({
      ...it,
      selisih:      it.totalAkt - it.totalEst,
      nilaiSelisih: (it.totalAkt - it.totalEst) * it.harga,
    })).sort((a,b) => Math.abs(b.nilaiSelisih) - Math.abs(a.nilaiSelisih));
    const totalNilai = rows.reduce((s,r) => s + r.nilaiSelisih, 0);

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4);margin-bottom:var(--s4)">
        <div style="font-size:11px;font-weight:700;color:var(--text-3)">TOTAL SELISIH NILAI</div>
        <div style="font-size:26px;font-weight:700;margin-top:4px;color:${totalNilai>=0?'#ef4444':'#10b981'}">
          ${totalNilai>=0?'+':''}${totalNilai.toLocaleString('id-ID')}
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-top:4px">
          + = aktual melebihi estimasi &nbsp;|&nbsp; − = aktual lebih hemat dari estimasi
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:var(--s4);border-bottom:1px solid var(--border)">
          <span style="font-size:13px;font-weight:700">Selisih Estimasi vs Aktual per Bahan</span>
        </div>
        ${rows.length===0
          ? `<div style="padding:48px;text-align:center;color:var(--text-3)">Belum ada data form produksi</div>`
          : `<div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                  <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                    <th style="padding:8px;text-align:left;color:var(--text-3)">ITEM</th>
                    <th style="padding:8px;text-align:right;color:#6366f1">EST QTY</th>
                    <th style="padding:8px;text-align:right;color:#10b981">AKT QTY</th>
                    <th style="padding:8px;text-align:center;color:var(--text-3)">SAT</th>
                    <th style="padding:8px;text-align:right;color:var(--text-3)">SELISIH QTY</th>
                    <th style="padding:8px;text-align:right;color:var(--text-3)">NILAI SELISIH</th>
                    <th style="padding:8px;text-align:center;color:var(--text-3)">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((r,i) => {
                    const ok    = Math.abs(r.selisih) < 0.05;
                    const over  = r.selisih > 0.05;
                    return `
                    <tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.018)':''}">
                      <td style="padding:8px;font-weight:600">${r.item}</td>
                      <td style="padding:8px;text-align:right;color:#6366f1">${r.totalEst.toLocaleString('id-ID',{maximumFractionDigits:2})}</td>
                      <td style="padding:8px;text-align:right;color:#10b981">${r.totalAkt.toLocaleString('id-ID',{maximumFractionDigits:2})}</td>
                      <td style="padding:8px;text-align:center;color:var(--text-3)">${r.satuan||'-'}</td>
                      <td style="padding:8px;text-align:right;font-weight:600;color:${ok?'var(--text-3)':over?'#ef4444':'#6366f1'}">
                        ${ok?'-':(r.selisih>0?'+':'')+r.selisih.toLocaleString('id-ID',{maximumFractionDigits:2})}
                      </td>
                      <td style="padding:8px;text-align:right;font-weight:600;color:${ok?'var(--text-3)':over?'#ef4444':'#6366f1'}">
                        ${ok?'-':(r.nilaiSelisih>0?'+':'')+r.nilaiSelisih.toLocaleString('id-ID')}
                      </td>
                      <td style="padding:8px;text-align:center">
                        <span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;
                          background:${ok?'rgba(16,185,129,.1)':over?'rgba(239,68,68,.1)':'rgba(99,102,241,.1)'};
                          color:${ok?'#10b981':over?'#ef4444':'#6366f1'}">
                          ${ok?'OK':over?'OVER':'HEMAT'}
                        </span>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>`;
  }

  /* ─── SUMMARY ─── */
  function _htmlSummary() {
    // ── Month helpers ──
    const [yr, mo] = _summaryMonth.split('-').map(Number);
    const monthLabel = new Date(yr, mo-1, 1).toLocaleDateString('id-ID',{month:'long',year:'numeric'});
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const prevM = mo===1 ? `${yr-1}-12` : `${yr}-${String(mo-1).padStart(2,'0')}`;
    const nextM = mo===12? `${yr+1}-01` : `${yr}-${String(mo+1).padStart(2,'0')}`;

    // ── Filter orders for this month ──
    const monthOrds = _orders.filter(o => o.tglOrder && o.tglOrder.slice(0,7) === _summaryMonth);

    // ── Compute meals + snacks helper ──
    function _ordMeals(o)  { return _n(o.breakfast)+_n(o.shift1)+_n(o.spare1)+_n(o.ot1)+_n(o.shift2)+_n(o.spare2)+_n(o.ot2)+_n(o.shift3)+_n(o.spare3)+_n(o.ot3); }
    function _ordSnacks(o) { return _n(o.snack1)+_n(o.snack2)+_n(o.snack3)+_n(o.snackBerat); }

    // ── Collect customers sorted by monthly volume ──
    const custVol = {};
    monthOrds.forEach(o => {
      custVol[o.namaPerusahaan] = (custVol[o.namaPerusahaan]||0) + _ordMeals(o) + _ordSnacks(o);
    });
    const customers = Object.keys(custVol).sort((a,b) => custVol[b]-custVol[a]);

    // ── Build cross-tab rows (all days in month) ──
    const rows = [];
    for (let d=1; d<=daysInMonth; d++) {
      const dateStr = `${_summaryMonth}-${String(d).padStart(2,'0')}`;
      const dayOrds = monthOrds.filter(o => o.tglOrder === dateStr);
      const cells = {};
      let totMeals=0, totSnacks=0;
      dayOrds.forEach(o => {
        const m = _ordMeals(o), s = _ordSnacks(o);
        cells[o.namaPerusahaan] = (cells[o.namaPerusahaan]||0) + m + s;
        totMeals += m; totSnacks += s;
      });
      rows.push({dateStr, d, cells, totMeals, totSnacks, hasData: dayOrds.length>0});
    }

    // ── Column totals ──
    const custTotals = {};
    let grandMeals=0, grandSnacks=0;
    rows.forEach(r => {
      customers.forEach(c => { custTotals[c] = (custTotals[c]||0) + (r.cells[c]||0); });
      grandMeals += r.totMeals; grandSnacks += r.totSnacks;
    });
    const activeDays = rows.filter(r=>r.hasData).length;

    // ── Stats cards ──
    const statsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${[
          {label:'Hari Aktif',         value:activeDays,                                      unit:'hari',  color:'#6366f1'},
          {label:'Total Porsi',        value:(grandMeals+grandSnacks).toLocaleString('id-ID'), unit:'porsi', color:'#10b981'},
          {label:'Total Makanan',      value:grandMeals.toLocaleString('id-ID'),               unit:'porsi', color:'#8b5cf6'},
          {label:'Total Snack',        value:grandSnacks.toLocaleString('id-ID'),              unit:'porsi', color:'#f59e0b'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4)">
            <div style="font-size:11px;color:var(--text-3);font-weight:600">${s.label}</div>
            <div style="font-size:20px;font-weight:700;color:${s.color};margin-top:4px">${s.value}</div>
            ${s.unit?`<div style="font-size:11px;color:var(--text-3)">${s.unit}</div>`:''}
          </div>
        `).join('')}
      </div>`;

    if (customers.length === 0) return statsHtml + `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:48px;text-align:center;color:var(--text-3)">
        <div style="font-size:32px;margin-bottom:10px">📅</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px">Tidak ada order untuk bulan ini</div>
        <div style="font-size:12px">Import order terlebih dahulu</div>
      </div>`;

    // ── Cell renderer ──
    const cell = (v) => v ? `<td style="padding:6px 5px;text-align:right;font-weight:600">${v.toLocaleString('id-ID')}</td>`
                          : `<td style="padding:6px 5px;text-align:center;color:var(--border)">-</td>`;

    return statsHtml + `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <!-- Header: month nav -->
        <div style="padding:var(--s3) var(--s4);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="font-size:13px;font-weight:700">Daily Order Summary</div>
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="DailyOrderModule.setMonth('${prevM}')"
              style="padding:5px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">‹ Prev</button>
            <span style="font-size:13px;font-weight:700;min-width:140px;text-align:center">${monthLabel}</span>
            <button onclick="DailyOrderModule.setMonth('${nextM}')"
              style="padding:5px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">Next ›</button>
          </div>
          <span style="font-size:11px;color:var(--text-3)">${activeDays} hari aktif / ${customers.length} customer</span>
        </div>

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <!-- Customer name row -->
              <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                <th style="padding:7px 8px;text-align:left;color:var(--text-3);font-weight:700;white-space:nowrap;border-right:1px solid var(--border)">TANGGAL</th>
                ${customers.map(c=>`
                  <th style="padding:7px 5px;text-align:right;color:var(--primary);font-weight:600;white-space:nowrap;font-size:10px">${c}</th>
                `).join('')}
                <th style="padding:7px 5px;text-align:right;color:#10b981;font-weight:700;white-space:nowrap;border-left:1px solid var(--border)">JUMLAH<br><span style="font-size:9px;font-weight:400">(Makan+Snack)</span></th>
                <th style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:700;white-space:nowrap">JUMLAH<br><span style="font-size:9px;font-weight:400">(Makanan)</span></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r,i) => {
                const isToday = r.dateStr === _today();
                const dow = new Date(r.dateStr+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short'});
                const isSun = new Date(r.dateStr+'T00:00:00').getDay()===0;
                return `
                <tr style="border-bottom:1px solid var(--border);
                  ${isToday?'background:rgba(99,102,241,.06);font-weight:700;':isSun?'background:rgba(239,68,68,.03);':i%2?'background:rgba(0,0,0,.015)':''}">
                  <td style="padding:6px 8px;font-size:11px;white-space:nowrap;border-right:1px solid var(--border);color:${isSun?'#ef4444':'var(--text)'}">
                    <strong style="color:${isToday?'var(--primary)':'inherit'}">${String(r.d).padStart(2,'0')}</strong>
                    <span style="color:var(--text-3);margin-left:4px;font-size:10px">${dow}</span>
                    ${isToday?`<span style="font-size:9px;background:rgba(99,102,241,.15);color:var(--primary);padding:1px 5px;border-radius:8px;margin-left:4px;font-weight:700">HARI INI</span>`:''}
                  </td>
                  ${customers.map(c => cell(r.cells[c]||0)).join('')}
                  <td style="padding:6px 5px;text-align:right;font-weight:700;border-left:1px solid var(--border);color:${r.hasData?'#10b981':'var(--border)'}">${r.hasData?(r.totMeals+r.totSnacks).toLocaleString('id-ID'):'-'}</td>
                  <td style="padding:6px 5px;text-align:right;font-weight:700;color:${r.hasData?'#6366f1':'var(--border)'}">${r.hasData?r.totMeals.toLocaleString('id-ID'):'-'}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface2);border-top:2px solid var(--border);font-weight:700">
                <td style="padding:8px;color:var(--text-3);font-size:11px;border-right:1px solid var(--border)">TOTAL</td>
                ${customers.map(c=>`
                  <td style="padding:8px 5px;text-align:right;color:var(--primary)">${custTotals[c]?custTotals[c].toLocaleString('id-ID'):'-'}</td>
                `).join('')}
                <td style="padding:8px 5px;text-align:right;color:#10b981;border-left:1px solid var(--border)">${(grandMeals+grandSnacks).toLocaleString('id-ID')}</td>
                <td style="padding:8px 5px;text-align:right;color:#6366f1">${grandMeals.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  }

  /* ─── ROW RENDERERS ─── */
  function _htmlItemRow(it, i) {
    const aktQ = _n(it.aktQty), harga = _n(it.hargaSatuan);
    const sumber = it.sumber || 'STOK';
    return `
      <tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.018)':''}">
        <td style="padding:7px 5px;text-align:center;color:var(--text-3)">${i+1}</td>
        <td style="padding:7px 5px;font-weight:600">${it.item}</td>
        <td style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:600">${it.estQty||'-'}</td>
        <td style="padding:7px 5px;text-align:center;color:var(--text-3)">${it.satuan||'-'}</td>
        <td style="padding:7px 5px;text-align:right;color:var(--text-3)">${harga?harga.toLocaleString('id-ID'):'-'}</td>
        <td style="padding:7px 5px;text-align:right;color:#6366f1">${_n(it.estTotal)?_n(it.estTotal).toLocaleString('id-ID'):'-'}</td>
        <td style="padding:7px 5px;text-align:right;color:#10b981;font-weight:600">${aktQ||'-'}</td>
        <td style="padding:7px 5px;text-align:right;color:#10b981">${_n(it.aktTotal)?_n(it.aktTotal).toLocaleString('id-ID'):'-'}</td>
        <td style="padding:7px 5px;text-align:center">
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;
            background:${sumber==='PASAR'?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)'};
            color:${sumber==='PASAR'?'#ef4444':'#10b981'}">${sumber}</span>
        </td>
        <td style="padding:7px 5px;color:var(--text-3);font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis">${it.catatan||''}</td>
        <td style="padding:7px 5px;text-align:center;white-space:nowrap">
          <button onclick="DailyOrderModule.startEditItem('${it.id}')" title="Edit"
            style="width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:11px">✎</button>
          <button onclick="DailyOrderModule.deleteItem('${it.id}')" title="Hapus"
            style="width:22px;height:22px;border-radius:4px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;font-size:11px;margin-left:2px">✕</button>
        </td>
      </tr>`;
  }

  function _htmlEditRow(it, idx) {
    const isNew = !it;
    // Build deduplicated datalist from inventory
    const dlId = 'di-inv-list';
    const uniqueNames = _inventory.length
      ? [...new Set(_inventory.map(i=>i.nama).filter(Boolean))].sort()
      : [];
    const dlHtml = uniqueNames.length
      ? `<datalist id="${dlId}">${uniqueNames.map(n=>`<option value="${n}">`).join('')}</datalist>`
      : '';
    // Pre-compute for existing item display
    const harga0 = _n(it?.hargaSatuan);
    const estQ0  = _n(it?.estQty),  aktQ0 = _n(it?.aktQty);
    const stok0  = _n(it?.stokGudang);
    const sumb0  = aktQ0 > stok0 && (stok0 > 0) ? 'PASAR' : 'STOK';
    const inp    = (p) => `padding:3px 5px;font-size:11px;${p}`;
    return `
      <tr style="border-bottom:1px solid var(--border);background:rgba(99,102,241,.04)">
        <td style="padding:4px 3px;text-align:center;color:var(--primary);font-size:11px;font-weight:700">${isNew?'✦':idx+1}</td>
        <td style="padding:4px 3px;min-width:140px">
          ${dlHtml}
          <input type="hidden" id="di-stok" value="${stok0||0}">
          <input id="di-item" list="${dlId}" class="form-control" style="${inp('min-width:120px')}"
            placeholder="Nama bahan..." value="${it?.item||''}"
            onchange="DailyOrderModule._autoFillFromInventory()"
            oninput="DailyOrderModule._liveCompute()"
            onkeydown="DailyOrderModule._editKeyDown(event,'di-estqty')">
        </td>
        <td style="padding:4px 3px">
          <input id="di-estqty" class="form-control" style="${inp('text-align:right;width:60px')}"
            type="number" step="0.01" min="0" placeholder="0" value="${estQ0||''}"
            oninput="DailyOrderModule._liveCompute()"
            onkeydown="DailyOrderModule._editKeyDown(event,'di-harga')">
        </td>
        <td style="padding:4px 3px">
          <select id="di-sat" class="form-control" style="${inp('width:65px')}">
            ${_SATS.map(s=>`<option value="${s}" ${(it?.satuan||'Kg')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td style="padding:4px 3px">
          <input id="di-harga" class="form-control" style="${inp('text-align:right;width:80px')}"
            type="number" step="100" min="0" placeholder="0" value="${harga0||''}"
            oninput="DailyOrderModule._liveCompute()"
            onkeydown="DailyOrderModule._editKeyDown(event,'di-aktqty')">
        </td>
        <td id="di-esttot-d" style="padding:4px 6px;text-align:right;color:#6366f1;font-size:11px;white-space:nowrap">
          ${estQ0&&harga0?(estQ0*harga0).toLocaleString('id-ID'):'-'}
        </td>
        <td style="padding:4px 3px">
          <input id="di-aktqty" class="form-control" style="${inp('text-align:right;width:60px')}"
            type="number" step="0.01" min="0" placeholder="0" value="${aktQ0||''}"
            oninput="DailyOrderModule._liveCompute()"
            onkeydown="DailyOrderModule._editKeyDown(event,'di-catatan')">
        </td>
        <td id="di-akttot-d" style="padding:4px 6px;text-align:right;color:#10b981;font-size:11px;white-space:nowrap">
          ${aktQ0&&harga0?(aktQ0*harga0).toLocaleString('id-ID'):'-'}
        </td>
        <td style="padding:4px 6px;text-align:center">
          <span id="di-sumb-d" style="font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;
            background:${sumb0==='PASAR'?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)'};
            color:${sumb0==='PASAR'?'#ef4444':'#10b981'}">${sumb0}</span>
        </td>
        <td style="padding:4px 3px;min-width:90px">
          <input id="di-catatan" class="form-control" style="${inp('')}"
            placeholder="Catatan..." value="${it?.catatan||''}"
            onkeydown="DailyOrderModule._editKeyDown(event,null)">
        </td>
        <td style="padding:4px 3px;text-align:center;white-space:nowrap">
          <button onclick="DailyOrderModule._saveEditRow()" title="Simpan [Enter]"
            style="width:24px;height:24px;border-radius:4px;border:none;background:#10b981;cursor:pointer;color:#fff;font-size:14px;font-weight:700;line-height:1">✓</button>
          <button onclick="DailyOrderModule._cancelEdit()" title="Batal [Esc]"
            style="width:24px;height:24px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:12px;margin-left:2px;line-height:1">✕</button>
        </td>
      </tr>`;
  }

  /* Live-compute EST TOTAL, AKT TOTAL, SUMBER while typing */
  function _liveCompute() {
    const estQty = parseFloat(document.getElementById('di-estqty')?.value||0)||0;
    const aktQty = parseFloat(document.getElementById('di-aktqty')?.value||0)||0;
    const stok   = parseFloat(document.getElementById('di-stok')?.value||0)  ||0;
    const harga  = parseFloat(document.getElementById('di-harga')?.value||0) ||0;
    const sumber = (stok > 0 && aktQty > stok) ? 'PASAR' : 'STOK';
    const $ = (id) => document.getElementById(id);
    if ($('di-esttot-d')) $('di-esttot-d').textContent = estQty&&harga ? (estQty*harga).toLocaleString('id-ID') : '-';
    if ($('di-akttot-d')) $('di-akttot-d').textContent = aktQty&&harga ? (aktQty*harga).toLocaleString('id-ID') : '-';
    if ($('di-sumb-d'))   { $('di-sumb-d').textContent = sumber; $('di-sumb-d').style.background=sumber==='PASAR'?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)'; $('di-sumb-d').style.color=sumber==='PASAR'?'#ef4444':'#10b981'; }
  }

  /* Auto-fill satuan/harga from inventory when item selected */
  function _autoFillFromInventory() {
    if (!_inventory.length) return;
    const val = document.getElementById('di-item')?.value.trim().toLowerCase();
    const inv = _inventory.find(i => (i.nama||'').toLowerCase() === val);
    if (!inv) return;
    const satEl   = document.getElementById('di-sat');
    const hargaEl = document.getElementById('di-harga');
    const stokEl  = document.getElementById('di-stok');
    if (satEl   && inv.satuan) satEl.value = inv.satuan;
    if (hargaEl && !parseFloat(hargaEl.value||0)) hargaEl.value = inv.harga||inv.hargaBeli||0;
    if (stokEl)  stokEl.value = inv.stok||inv.qty||inv.jumlah||0;
    _liveCompute();
  }

  /* Tab/Enter key navigation between inline inputs */
  function _editKeyDown(e, nextId) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextId) document.getElementById(nextId)?.focus();
      else _saveEditRow();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      _cancelEdit();
    }
  }

  /* Save inline edit row */
  async function _saveEditRow() {
    const form = _currentForm();
    if (!form) return;
    const item     = document.getElementById('di-item')?.value.trim();
    if (!item) { Notify.warning('Nama bahan wajib diisi'); document.getElementById('di-item')?.focus(); return; }
    const estQty   = parseFloat(document.getElementById('di-estqty')?.value||0)||0;
    const satuan   = document.getElementById('di-sat')?.value||'Kg';
    const harga    = parseFloat(document.getElementById('di-harga')?.value||0)||0;
    const aktQty   = parseFloat(document.getElementById('di-aktqty')?.value||0)||0;
    const stokGud  = parseFloat(document.getElementById('di-stok')?.value||0)  ||0;
    const catatan  = document.getElementById('di-catatan')?.value.trim()||'';
    const sumber   = (stokGud > 0 && aktQty > stokGud) ? 'PASAR' : 'STOK';
    const data = { item, estQty, satuan, hargaSatuan:harga, aktQty, stokGudang:stokGud, sumber, catatan,
      estTotal: estQty*harga, aktTotal: aktQty*harga };
    const wasNew = _editingItemId === 'new';
    if (wasNew) {
      form.items.push({ id:'item_'+Date.now(), ...data });
    } else {
      const it = (form.items||[]).find(i => i.id === _editingItemId);
      if (it) Object.assign(it, data);
    }
    form.updatedAt = new Date().toISOString();
    await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] saveRow:', e));
    _editingItemId = 'new'; // always enter 'new' row mode after saving (fast entry)
    _renderContent();
    if (!wasNew) Notify.success('Bahan diperbarui');
    setTimeout(() => document.getElementById('di-item')?.focus(), 60);
  }

  function _cancelEdit() { _editingItemId = null; _renderContent(); }

  /* ─── ACTIONS ─── */
  function setView(v) {
    _view = v;
    const page = document.getElementById('page-daily-order');
    if (page) _renderFull(page);
  }

  function setDate(d) { _date = d; _renderContent(); }
  function setShift(s) { _shift = s; _renderContent(); }
  function setMonth(m) { _summaryMonth = m; _renderContent(); }

  async function createForm() {
    const form = {
      id       : 'do_' + _date.replace(/-/g,'') + '_' + _shift,
      tanggal  : _date,
      shift    : _shift,
      budgetBelanja: 0,
      items    : [],
      status   : 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    _forms.push(form);
    await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] createForm:', e));
    _renderContent();
    Notify.success('Form produksi dibuat');
  }

  async function toggleStatus() {
    const form = _currentForm();
    if (!form) return;
    form.status    = form.status === 'final' ? 'draft' : 'final';
    form.updatedAt = new Date().toISOString();
    await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] toggleStatus:', e));
    _renderContent();
    Notify.success(form.status === 'final' ? 'Form difinalisasi' : 'Form dibuka kembali');
  }

  async function deleteForm() {
    const form = _currentForm();
    if (!form) return;
    const ok = await Modal.confirm({
      title:'Hapus Form Produksi',
      message:`Hapus form produksi <strong>${_fmtDate(form.tanggal)} / ${form.shift}</strong> beserta semua bahannya?`,
      confirmText:'Hapus', danger:true,
    });
    if (!ok) return;
    _forms = _forms.filter(f => f.id !== form.id);
    await DB.deleteDailyOrderForm(form.id).catch(e => console.warn('[DO] deleteForm:', e));
    _renderContent();
    Notify.success('Form dihapus');
  }

  function openBudget() {
    const form = _currentForm();
    if (!form) return;
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: 'Set Budget Belanja Harian',
      body: `
        <div class="form-group">
          <label class="form-label">Budget Belanja (Rp)</label>
          <input class="form-control" id="do-budget" type="number" min="0" placeholder="0" value="${form.budgetBelanja||''}">
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="DailyOrderModule._saveBudget('${mid}')">Simpan</button>`,
    });
    setTimeout(() => document.getElementById('do-budget')?.focus(), 100);
  }

  async function _saveBudget(mid) {
    const form = _currentForm();
    if (!form) return;
    const val = parseFloat(document.getElementById('do-budget')?.value||0) || 0;
    form.budgetBelanja = val;
    form.updatedAt = new Date().toISOString();
    await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] setBudget:', e));
    Modal.close(mid);
    _renderContent();
    Notify.success('Budget disimpan');
  }

  function startAddItem() {
    const form = _currentForm();
    if (!form) { Notify.warning('Buat form produksi dulu'); return; }
    _editingItemId = 'new';
    _renderContent();
    setTimeout(() => document.getElementById('di-item')?.focus(), 60);
  }

  function startEditItem(itemId) {
    _editingItemId = itemId;
    _renderContent();
    setTimeout(() => document.getElementById('di-item')?.focus(), 60);
  }

  async function deleteItem(itemId) {
    const form = _currentForm();
    if (!form) return;
    const it = (form.items||[]).find(i => i.id === itemId);
    if (!it) return;
    const ok = await Modal.confirm({
      title:'Hapus Bahan',
      message:`Hapus <strong>${it.item}</strong> dari form ini?`,
      confirmText:'Hapus', danger:true,
    });
    if (!ok) return;
    form.items     = form.items.filter(i => i.id !== itemId);
    form.updatedAt = new Date().toISOString();
    await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] deleteItem:', e));
    _renderContent();
    Notify.success('Bahan dihapus');
  }

  function goToDate(date) {
    _date = date;
    _view = 'form';
    const page = document.getElementById('page-daily-order');
    if (page) _renderFull(page);
  }

  /* ─── PUBLIC ─── */
  return {
    init, setView, setDate, setShift, setMonth,
    createForm, toggleStatus, deleteForm,
    openBudget, _saveBudget,
    startAddItem, startEditItem,
    _saveEditRow, _cancelEdit, _editKeyDown, _liveCompute, _autoFillFromInventory,
    deleteItem, goToDate,
  };
})();

window.DailyOrderModule = DailyOrderModule;
