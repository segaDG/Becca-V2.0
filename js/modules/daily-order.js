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
      const [forms, orders] = await Promise.all([
        DB.getDailyOrderForms().catch(() => []),
        DB.getOrders().catch(() => []),
      ]);
      _forms  = Array.isArray(forms)  ? forms  : [];
      _orders = Array.isArray(orders) ? orders : [];
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
    const totalPasar   = items.filter(it => it.sumber==='PASAR').reduce((s,it) => s + (_n(it.aktTotal)||_n(it.estTotal)), 0);
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
              <button onclick="DailyOrderModule.openAddItem()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer;font-weight:600">+ Tambah Bahan</button>
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
          : items.length===0
          ? `<div style="padding:48px;text-align:center;color:var(--text-3)">
               <div style="font-size:36px;margin-bottom:10px">📦</div>
               <div style="font-size:14px;font-weight:600;margin-bottom:4px">Belum ada bahan ditambahkan</div>
               <div style="font-size:12px">Klik "+ Tambah Bahan" untuk menambah bahan produksi</div>
             </div>`
          : `<div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px">
                <thead>
                  <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
                    <th style="padding:8px 6px;text-align:center;color:var(--text-3);font-weight:600;width:36px">#</th>
                    <th style="padding:8px 6px;text-align:left;color:var(--text-3);font-weight:600;min-width:140px">ITEM / BAHAN</th>
                    <th style="padding:8px 6px;text-align:right;color:#6366f1;font-weight:600">EST QTY</th>
                    <th style="padding:8px 6px;text-align:center;color:var(--text-3);font-weight:600">SAT</th>
                    <th style="padding:8px 6px;text-align:right;color:var(--text-3);font-weight:600;white-space:nowrap">HARGA/SAT</th>
                    <th style="padding:8px 6px;text-align:right;color:#6366f1;font-weight:600;white-space:nowrap">EST TOTAL</th>
                    <th style="padding:8px 6px;text-align:right;color:#10b981;font-weight:600">AKT QTY</th>
                    <th style="padding:8px 6px;text-align:right;color:#10b981;font-weight:600;white-space:nowrap">AKT TOTAL</th>
                    <th style="padding:8px 6px;text-align:center;color:var(--text-3);font-weight:600">SUMBER</th>
                    <th style="padding:8px 6px;text-align:left;color:var(--text-3);font-weight:600">CATATAN</th>
                    <th style="padding:8px 6px;width:56px"></th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((it,i) => `
                    <tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.018)':''}">
                      <td style="padding:8px 6px;text-align:center;color:var(--text-3)">${i+1}</td>
                      <td style="padding:8px 6px;font-weight:600">${it.item}</td>
                      <td style="padding:8px 6px;text-align:right;color:#6366f1;font-weight:600">${it.estQty||'-'}</td>
                      <td style="padding:8px 6px;text-align:center;color:var(--text-3)">${it.satuan||'-'}</td>
                      <td style="padding:8px 6px;text-align:right;color:var(--text-3)">${it.hargaSatuan?_n(it.hargaSatuan).toLocaleString('id-ID'):'-'}</td>
                      <td style="padding:8px 6px;text-align:right;color:#6366f1">${it.estTotal?_n(it.estTotal).toLocaleString('id-ID'):'-'}</td>
                      <td style="padding:8px 6px;text-align:right;color:#10b981;font-weight:600">${it.aktQty||'-'}</td>
                      <td style="padding:8px 6px;text-align:right;color:#10b981">${it.aktTotal?_n(it.aktTotal).toLocaleString('id-ID'):'-'}</td>
                      <td style="padding:8px 6px;text-align:center">
                        <span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;
                          background:${it.sumber==='PASAR'?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)'};
                          color:${it.sumber==='PASAR'?'#ef4444':'#10b981'}">
                          ${it.sumber||'STOK'}
                        </span>
                      </td>
                      <td style="padding:8px 6px;color:var(--text-3);font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis">${it.catatan||''}</td>
                      <td style="padding:8px 6px;text-align:center;white-space:nowrap">
                        <button onclick="DailyOrderModule.editItem('${it.id}')" title="Edit"
                          style="width:24px;height:24px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:11px">✎</button>
                        <button onclick="DailyOrderModule.deleteItem('${it.id}')" title="Hapus"
                          style="width:24px;height:24px;border-radius:4px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;font-size:11px;margin-left:2px">✕</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:var(--surface2);border-top:2px solid var(--border);font-weight:700">
                    <td colspan="5" style="padding:10px 6px;text-align:right;color:var(--text-3);font-size:11px">TOTAL ESTIMASI</td>
                    <td style="padding:10px 6px;text-align:right;color:#6366f1">${totalEst.toLocaleString('id-ID')}</td>
                    <td style="padding:10px 6px;text-align:right;color:var(--text-3);font-size:11px">AKTUAL</td>
                    <td style="padding:10px 6px;text-align:right;color:#10b981">${totalAkt.toLocaleString('id-ID')}</td>
                    <td colspan="3" style="padding:10px 6px;color:var(--text-3);font-size:11px">
                      Belanja Pasar: <strong style="color:#ef4444">${_fmtRp(totalPasar)}</strong>
                    </td>
                  </tr>
                </tfoot>
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
    const dayMap = {};
    _forms.forEach(f => {
      if (!dayMap[f.tanggal]) dayMap[f.tanggal] = {tanggal:f.tanggal, portions:0, totalEst:0, totalAkt:0, forms:[]};
      const d = dayMap[f.tanggal];
      d.portions  += _getOrderSummary(f.tanggal, f.shift).reduce((s,c) => s+c.total, 0);
      d.totalEst  += (f.items||[]).reduce((s,it) => s+_n(it.estTotal), 0);
      d.totalAkt  += (f.items||[]).reduce((s,it) => s+_n(it.aktTotal), 0);
      d.forms.push(f);
    });
    const days     = Object.values(dayMap).sort((a,b) => a.tanggal.localeCompare(b.tanggal));
    const totPort  = days.reduce((s,d) => s+d.portions, 0);
    const totEst   = days.reduce((s,d) => s+d.totalEst, 0);
    const totAkt   = days.reduce((s,d) => s+d.totalAkt, 0);

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${[
          {label:'Hari Aktif',      value:days.length,          unit:'hari',  color:'#6366f1'},
          {label:'Total Porsi',     value:totPort.toLocaleString('id-ID'), unit:'porsi', color:'#10b981'},
          {label:'Total Est HPP',   value:_fmtRp(totEst),       unit:'',      color:'#f59e0b'},
          {label:'Total Aktual HPP',value:_fmtRp(totAkt),       unit:'',      color:'#ec4899'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4)">
            <div style="font-size:11px;color:var(--text-3);font-weight:600">${s.label}</div>
            <div style="font-size:18px;font-weight:700;color:${s.color};margin-top:4px">${s.value}</div>
            ${s.unit?`<div style="font-size:11px;color:var(--text-3)">${s.unit}</div>`:''}
          </div>
        `).join('')}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:var(--s4);border-bottom:1px solid var(--border)">
          <span style="font-size:13px;font-weight:700">Daily Order Summary</span>
          <span style="font-size:11px;color:var(--text-3);margin-left:8px">${days.length} hari</span>
        </div>
        ${days.length===0
          ? `<div style="padding:48px;text-align:center;color:var(--text-3)">Belum ada data form produksi</div>`
          : `<div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                  <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                    <th style="padding:8px;text-align:left;color:var(--text-3)">TANGGAL</th>
                    <th style="padding:8px;text-align:center;color:var(--text-3)">FORM</th>
                    <th style="padding:8px;text-align:right;color:var(--text-3)">PORSI</th>
                    <th style="padding:8px;text-align:right;color:#6366f1">EST HPP</th>
                    <th style="padding:8px;text-align:right;color:#10b981">AKT HPP</th>
                    <th style="padding:8px;text-align:right;color:var(--text-3)">SELISIH</th>
                    <th style="padding:8px;text-align:center;color:var(--text-3)">STATUS</th>
                    <th style="padding:8px;width:60px"></th>
                  </tr>
                </thead>
                <tbody>
                  ${days.map((d,i) => {
                    const sel    = d.totalAkt - d.totalEst;
                    const isToday= d.tanggal === _today();
                    const allFinal = d.forms.every(f => f.status==='final');
                    return `
                    <tr style="border-bottom:1px solid var(--border);${isToday?'background:rgba(99,102,241,.05);':i%2?'background:rgba(0,0,0,.018)':''}">
                      <td style="padding:8px;font-weight:${isToday?'700':'600'}">
                        ${_fmtDate(d.tanggal)}
                        ${isToday?`<span style="font-size:9px;background:rgba(99,102,241,.15);color:var(--primary);padding:1px 6px;border-radius:10px;margin-left:4px;font-weight:700">HARI INI</span>`:''}
                      </td>
                      <td style="padding:8px;text-align:center;color:var(--text-3)">${d.forms.length}</td>
                      <td style="padding:8px;text-align:right;font-weight:600">${d.portions.toLocaleString('id-ID')}</td>
                      <td style="padding:8px;text-align:right;color:#6366f1">${d.totalEst?d.totalEst.toLocaleString('id-ID'):'-'}</td>
                      <td style="padding:8px;text-align:right;color:#10b981">${d.totalAkt?d.totalAkt.toLocaleString('id-ID'):'-'}</td>
                      <td style="padding:8px;text-align:right;font-weight:600;color:${sel>0?'#ef4444':sel<0?'#6366f1':'var(--text-3)'}">
                        ${sel?((sel>0?'+':'')+sel.toLocaleString('id-ID')):'-'}
                      </td>
                      <td style="padding:8px;text-align:center">
                        <span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;
                          background:${allFinal?'rgba(16,185,129,.1)':'rgba(245,158,11,.1)'};
                          color:${allFinal?'#10b981':'#f59e0b'}">
                          ${allFinal?'✓ Final':'● Draft'}
                        </span>
                      </td>
                      <td style="padding:8px;text-align:center">
                        <button onclick="DailyOrderModule.goToDate('${d.tanggal}')"
                          style="padding:3px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);font-size:11px;cursor:pointer">
                          Buka
                        </button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
                <tfoot>
                  <tr style="background:var(--surface2);border-top:2px solid var(--border);font-weight:700">
                    <td colspan="2" style="padding:10px 8px;color:var(--text-3);font-size:11px">TOTAL</td>
                    <td style="padding:10px 8px;text-align:right">${totPort.toLocaleString('id-ID')}</td>
                    <td style="padding:10px 8px;text-align:right;color:#6366f1">${totEst?totEst.toLocaleString('id-ID'):'-'}</td>
                    <td style="padding:10px 8px;text-align:right;color:#10b981">${totAkt?totAkt.toLocaleString('id-ID'):'-'}</td>
                    <td colspan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>`
        }
      </div>`;
  }

  /* ─── ITEM MODAL HELPER ─── */
  function _itemModalContent(it) {
    const SATS = ['Kg','Pcs','Liter','Pack','Bal','Ikat','Bks','Lusin','Karton'];
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Nama Bahan / Item *</label>
          <input class="form-control" id="di-item" placeholder="cth: Ayam Potong" value="${it?.item||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Estimasi QTY</label>
          <input class="form-control" id="di-estqty" type="number" min="0" step="0.01" placeholder="0" value="${it?.estQty||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Satuan</label>
          <select class="form-control" id="di-sat">
            ${SATS.map(s=>`<option value="${s}" ${it?.satuan===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Harga / Satuan (Rp)</label>
          <input class="form-control" id="di-harga" type="number" min="0" placeholder="0" value="${it?.hargaSatuan||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Aktual QTY</label>
          <input class="form-control" id="di-aktqty" type="number" min="0" step="0.01" placeholder="0" value="${it?.aktQty||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Stok Awal Gudang</label>
          <input class="form-control" id="di-stok" type="number" min="0" step="0.01" placeholder="0" value="${it?.stokGudang||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Sumber</label>
          <select class="form-control" id="di-sumber">
            <option value="STOK" ${(!it||it.sumber==='STOK')?'selected':''}>STOK (Ambil dari Gudang)</option>
            <option value="PASAR" ${it?.sumber==='PASAR'?'selected':''}>PASAR (Beli di Pasar)</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Catatan</label>
          <input class="form-control" id="di-catatan" placeholder="Opsional" value="${it?.catatan||''}">
        </div>
      </div>`;
  }

  function _readItemForm() {
    const item       = document.getElementById('di-item')?.value.trim();
    const estQty     = parseFloat(document.getElementById('di-estqty')?.value||0) || 0;
    const satuan     = document.getElementById('di-sat')?.value || 'Kg';
    const hargaSatuan= parseFloat(document.getElementById('di-harga')?.value||0)  || 0;
    const aktQty     = parseFloat(document.getElementById('di-aktqty')?.value||0) || 0;
    const stokGudang = parseFloat(document.getElementById('di-stok')?.value||0)   || 0;
    const sumber     = document.getElementById('di-sumber')?.value || 'STOK';
    const catatan    = document.getElementById('di-catatan')?.value.trim() || '';
    return {item, estQty, satuan, hargaSatuan, aktQty, stokGudang, sumber, catatan,
      estTotal: estQty * hargaSatuan, aktTotal: aktQty * hargaSatuan, selisih: stokGudang - aktQty};
  }

  /* ─── ACTIONS ─── */
  function setView(v) {
    _view = v;
    const page = document.getElementById('page-daily-order');
    if (page) _renderFull(page);
  }

  function setDate(d) { _date = d; _renderContent(); }
  function setShift(s) { _shift = s; _renderContent(); }

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
    Modal.open({
      title:'Set Budget Belanja Harian',
      content:`
        <div class="form-group">
          <label class="form-label">Budget Belanja (Rp)</label>
          <input class="form-control" id="do-budget" type="number" min="0" placeholder="0" value="${form.budgetBelanja||''}">
        </div>`,
      onConfirm: async () => {
        const val = parseFloat(document.getElementById('do-budget')?.value||0) || 0;
        form.budgetBelanja = val;
        form.updatedAt = new Date().toISOString();
        await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] setBudget:', e));
        _renderContent();
        Notify.success('Budget disimpan');
      },
      confirmText:'Simpan',
    });
    setTimeout(() => document.getElementById('do-budget')?.focus(), 100);
  }

  function openAddItem() {
    const form = _currentForm();
    if (!form) { Notify.warning('Buat form produksi dulu'); return; }
    Modal.open({
      title:'Tambah Bahan Produksi',
      content: _itemModalContent(null),
      onConfirm: async () => {
        const data = _readItemForm();
        if (!data.item) { Notify.warning('Nama bahan wajib diisi'); return false; }
        form.items.push({ id:'item_'+Date.now(), ...data });
        form.updatedAt = new Date().toISOString();
        await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] addItem:', e));
        _renderContent();
        Notify.success('Bahan ditambahkan');
      },
      confirmText:'Tambah',
    });
    setTimeout(() => document.getElementById('di-item')?.focus(), 100);
  }

  function editItem(itemId) {
    const form = _currentForm();
    if (!form) return;
    const it = (form.items||[]).find(i => i.id === itemId);
    if (!it) return;
    Modal.open({
      title:'Edit Bahan',
      content: _itemModalContent(it),
      onConfirm: async () => {
        const data = _readItemForm();
        if (!data.item) { Notify.warning('Nama bahan wajib diisi'); return false; }
        Object.assign(it, data);
        form.updatedAt = new Date().toISOString();
        await DB.saveDailyOrderForm(form).catch(e => console.warn('[DO] editItem:', e));
        _renderContent();
        Notify.success('Bahan diperbarui');
      },
      confirmText:'Simpan',
    });
    setTimeout(() => document.getElementById('di-item')?.focus(), 100);
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
    init, setView, setDate, setShift,
    createForm, toggleStatus, deleteForm, openBudget,
    openAddItem, editItem, deleteItem, goToDate,
  };
})();

window.DailyOrderModule = DailyOrderModule;
