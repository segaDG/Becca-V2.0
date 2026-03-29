/* ============================================
   BECCA V2.0 — Daily Order Module
   Form Produksi, Data Analysis, Cek Selisih, Summary
============================================ */
const DailyOrderModule = (() => {
  /* ─── STATE ─── */
  let _view         = 'form';
  let _forms        = [];
  let _orders       = [];
  let _date         = new Date().toISOString().slice(0,10);
  let _shift        = 'S1';
  let _formMonth    = new Date().toISOString().slice(0,7);
  let _summaryMonth = new Date().toISOString().slice(0,7);
  let _editingItemId= null; // null | 'new' | existing item id
  let _saving       = false; // guard against double-save race condition
  let _inventory    = [];
  let _customers    = [];

  /* ─── CONSTANTS ─── */
  const _SATS        = ['Kg','Pcs','Liter','Pack','Bal','Ikat','Bks','Lusin','Karton','Gram','ML'];
  const _DAY_LABELS  = ['Mg','Sn','Sl','Rb','Km','Jm','Sb'];
  const _DEFAULT_FCP = 54; // default food cost %
  const _ALLOWED_META_FIELDS = new Set(['foodCostPct','budgetBelanja','status']);

  /* ─── HELPERS ─── */
  function _today() { return new Date().toISOString().slice(0,10); }

  function _fmtDate(s) {
    if (!s) return '-';
    try { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}); }
    catch { return s; }
  }

  function _fmtRp(n) {
    if (!n && n !== 0) return '-';
    return 'Rp\u00a0' + Number(n).toLocaleString('id-ID');
  }

  function _n(v) { return Number(v) || 0; }

  /* Determine PASAR vs STOK — single source of truth */
  function _calcSumber(stokGudang, aktQty) {
    return (stokGudang > 0 && aktQty > stokGudang) ? 'PASAR' : 'STOK';
  }

  function _currentForm() {
    return _forms.find(f => f.tanggal === _date && f.shift === _shift) || null;
  }

  /* ─── MONTH HELPERS ─── */
  function _daysInMonth(ym) {
    const [y,m] = ym.split('-').map(Number);
    return new Date(y,m,0).getDate();
  }
  function _adjMonth(ym, delta) {
    const [y,m] = ym.split('-').map(Number);
    const d = new Date(y,m-1+delta,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  /* ─── ORDER SUMMARY ─── */
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
        snacks = _n(o.snack2) + _n(o.snack3) + _n(o.snackBerat);
      }
      if (meals + snacks > 0) out.push({ nama: o.namaPerusahaan, meals, snacks, total: meals + snacks });
    });
    return out.sort((a,b) => b.total - a.total);
  }

  /* Revenue = Σ(qty × harga customer) per shift */
  function _calcRevenue(date, shift) {
    const dayOrds = _orders.filter(o => o.tglOrder === date);
    let total = 0;
    dayOrds.forEach(o => {
      const cname = (o.namaPerusahaan||'').toLowerCase();
      const c = _customers.find(x => (x.nama||x.namaPerusahaan||'').toLowerCase() === cname) || {};
      if (!Object.keys(c).length) {
        console.warn('[DO] _calcRevenue: no customer match for', o.namaPerusahaan);
      }
      if (shift === 'S1') {
        total += _n(o.breakfast) * _n(c.hargaBreakfast || c.hargaShift1);
        total += _n(o.shift1)    * _n(c.hargaShift1);
        total += _n(o.spare1)    * _n(c.hargaSpare1   || c.hargaShift1);
        total += _n(o.ot1)       * _n(c.hargaOT1      || c.hargaShift1);
        total += _n(o.snack1)    * _n(c.hargaSnack1);
      } else {
        total += _n(o.shift2)    * _n(c.hargaShift2);
        total += _n(o.spare2)    * _n(c.hargaSpare2   || c.hargaShift2);
        total += _n(o.ot2)       * _n(c.hargaOT2      || c.hargaShift2);
        total += _n(o.snack2)    * _n(c.hargaSnack2);
        total += _n(o.shift3)    * _n(c.hargaShift3);
        total += _n(o.spare3)    * _n(c.hargaSpare3   || c.hargaShift3);
        total += _n(o.ot3)       * _n(c.hargaOT3      || c.hargaShift3);
        total += _n(o.snack3)    * _n(c.hargaSnack3);
        total += _n(o.snackBerat)* _n(c.hargaSnackBerat);
      }
    });
    return total;
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-daily-order');
    if (!page) return;
    try {
      const [forms, orders, invItems, invLogs, custs] = await Promise.all([
        DB.getDailyOrderForms().catch(() => []),
        DB.getOrders().catch(() => []),
        DB.getInventoryItems().catch(() => []),
        DB.getInventory().catch(() => []),
        DB.getCustomers().catch(() => []),
      ]);
      _forms     = Array.isArray(forms)    ? forms    : [];
      _orders    = Array.isArray(orders)   ? orders   : [];
      _customers = Array.isArray(custs)    ? custs    : [];
      // Compute _stok per item from activities (MASUK - KELUAR)
      const items = Array.isArray(invItems) ? invItems : [];
      const logs  = Array.isArray(invLogs)  ? invLogs  : [];
      const logsByItem = {};
      logs.forEach(l => { if (l.itemId) { (logsByItem[l.itemId] = logsByItem[l.itemId]||[]).push(l); } });
      items.forEach(it => {
        const ls = logsByItem[it.id] || [];
        it._stok = ls.reduce((a,l) => l.jenis==='MASUK' ? a+(l.jumlah||0) : l.jenis==='KELUAR' ? a-(l.jumlah||0) : a, 0);
      });
      _inventory = items;
    } catch(e) {
      console.error('[DO] init error:', e);
      _forms = []; _orders = [];
    }
    _date      = _today();
    _formMonth = _date.slice(0,7);
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

    // Per-shift budget
    const fcp        = _n(form?.foodCostPct) || _DEFAULT_FCP;
    const revenue    = _calcRevenue(_date, _shift);
    const budgetVal  = revenue > 0 ? revenue * fcp / 100 : _n(form?.budgetBelanja);
    const budgetOk   = budgetVal <= 0 || totalEst <= budgetVal;

    // Total daily budget card — S1 + S2 combined for selected date
    const formS1     = _forms.find(f => f.tanggal === _date && f.shift === 'S1');
    const formS2     = _forms.find(f => f.tanggal === _date && f.shift === 'S2');
    const revS1      = _calcRevenue(_date, 'S1');
    const revS2      = _calcRevenue(_date, 'S2');
    const fcpS1      = _n(formS1?.foodCostPct) || _DEFAULT_FCP;
    const fcpS2      = _n(formS2?.foodCostPct) || _DEFAULT_FCP;
    const budS1      = revS1 > 0 ? revS1 * fcpS1 / 100 : _n(formS1?.budgetBelanja);
    const budS2      = revS2 > 0 ? revS2 * fcpS2 / 100 : _n(formS2?.budgetBelanja);
    const totBudget  = budS1 + budS2;
    const _spentOf   = f => (f?.items||[]).reduce((s,it) => {
      const v = (it.aktTotal !== null && it.aktTotal !== undefined && it.aktTotal !== '')
        ? _n(it.aktTotal) : _n(it.estTotal);
      return s + v;
    }, 0);
    const spentS1    = _spentOf(formS1);
    const spentS2    = _spentOf(formS2);
    const totSpent   = spentS1 + spentS2;
    const totSelisih = totBudget - totSpent;          // positive = surplus
    const totPct     = totBudget > 0 ? totSpent / totBudget * 100 : 0;
    const hasDayData = (formS1 || formS2) && totBudget > 0;

    // ── Mini date cards ──
    const days     = _daysInMonth(_formMonth);
    const firstDow = new Date(`${_formMonth}-01T00:00:00`).getDay();
    const cards    = Array.from({length:days},(_,i) => {
      const d       = i + 1;
      const dateStr = `${_formMonth}-${String(d).padStart(2,'0')}`;
      const hasS1   = _forms.some(f => f.tanggal === dateStr && f.shift === 'S1');
      const hasS2   = _forms.some(f => f.tanggal === dateStr && f.shift === 'S2');
      const sel     = _date === dateStr;
      const today   = dateStr === _today();
      const dow     = (firstDow + i) % 7;
      const isSun   = dow === 0;
      // Selected card: slightly taller, grows upward (parent is align-items:flex-end)
      const cW = sel ? 33 : 28;
      const cH = sel ? 44 : 36;
      const dayFs = sel ? '9px' : '8px';
      const numFs = sel ? '13px' : '11px';
      let bg = 'var(--surface2)', col = 'var(--text-3)', dayCol = 'var(--text-3)';
      if      (hasS1 && hasS2) { bg='#6366f1'; col='#fff'; dayCol='rgba(255,255,255,.7)'; }
      else if (hasS1)          { bg='#f59e0b'; col='#fff'; dayCol='rgba(255,255,255,.7)'; }
      else if (hasS2)          { bg='#f97316'; col='#fff'; dayCol='rgba(255,255,255,.7)'; }
      if (isSun && !hasS1 && !hasS2) { col='#ef4444'; dayCol='#ef4444'; }
      return `<button onclick="DailyOrderModule.setDate('${dateStr}')"
        title="${dateStr}" style="width:${cW}px;height:${cH}px;flex-shrink:0;border-radius:6px;
        border:2px solid ${sel?'#374151':'transparent'};
        background:${bg};cursor:pointer;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:1px;padding:0;position:relative">
        <span style="font-size:${dayFs};font-weight:600;color:${dayCol};line-height:1">${_DAY_LABELS[dow]}</span>
        <span style="font-size:${numFs};font-weight:700;color:${col};line-height:1">${d}</span>
        ${today?`<span style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);
          width:14px;height:1.5px;border-radius:2px;background:#39ff14;
          box-shadow:0 0 4px #39ff14;display:block"></span>`:''}

      </button>`;
    }).join('');

    return `
      <!-- Month nav + mini date cards -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 14px;margin-bottom:var(--s4)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <button onclick="DailyOrderModule.prevFormMonth()"
            style="width:28px;height:28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
          <input type="month" value="${_formMonth}" onchange="DailyOrderModule.setFormMonth(this.value)"
            style="padding:5px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-size:13px;font-weight:700;cursor:pointer">
          <button onclick="DailyOrderModule.nextFormMonth()"
            style="width:28px;height:28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center">›</button>
          <div style="margin-left:6px;display:flex;gap:10px;font-size:10px;color:var(--text-3)">
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#6366f1;margin-right:3px;vertical-align:middle"></span>S1+S2</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f59e0b;margin-right:3px;vertical-align:middle"></span>S1</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f97316;margin-right:3px;vertical-align:middle"></span>S2</span>
          </div>
        </div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;align-items:flex-end">${cards}</div>
      </div>

      <!-- Shift + meta -->
      <div style="display:flex;gap:var(--s3);align-items:flex-end;flex-wrap:wrap;margin-bottom:var(--s4)">
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
          <div>
            <label style="font-size:11px;color:var(--text-3);font-weight:600;display:block;margin-bottom:4px">FOOD COST (%)</label>
            <input type="number" min="0" max="100" step="0.5" placeholder="${_DEFAULT_FCP}"
              value="${form.foodCostPct != null ? form.foodCostPct : _DEFAULT_FCP}"
              onblur="DailyOrderModule.updateFormMeta('foodCostPct', +this.value)"
              style="padding:8px 10px;border:1px solid var(--primary);border-radius:8px;background:rgba(99,102,241,.06);color:var(--primary);font-size:13px;width:80px;text-align:right;font-weight:700">
          </div>
          <div style="align-self:flex-end">
            <div style="font-size:10px;color:var(--text-3);font-weight:600;margin-bottom:4px">
              BUDGET (${fcp}% × ${revenue > 0 ? _fmtRp(revenue) : '—'})
            </div>
            <div style="padding:8px 12px;border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap;
              background:${revenue > 0 ? (budgetOk?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)') : 'var(--surface2)'};
              color:${revenue > 0 ? (budgetOk?'#10b981':'#ef4444') : 'var(--text-3)'}">
              ${revenue > 0
                ? `${_fmtRp(budgetVal)}<span style="font-size:10px;font-weight:400;margin-left:4px">${budgetOk?'✓ Aman':'⚠ Over'}</span>`
                : `<span style="font-weight:400;font-size:11px">Perlu data order</span>`}
            </div>
          </div>
        ` : ''}

        ${hasDayData ? (() => {
          const _bc = totSelisih>=0 ? '#10b981' : '#ef4444';
          const _bl = totSelisih>=0 ? '▲ Surplus' : '▼ Defisit';
          return `
        <div style="margin-left:auto;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;min-width:220px">
          <div style="font-size:9px;font-weight:700;color:var(--text-3);letter-spacing:.05em;margin-bottom:5px">TOTAL BUDGET HARI INI</div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:5px">
            <div>
              <div style="font-size:8px;color:var(--text-3);margin-bottom:1px">TERPAKAI</div>
              <div style="font-size:12px;font-weight:700;color:var(--text)">${_fmtRp(totSpent)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:8px;color:var(--text-3);margin-bottom:1px">SELISIH</div>
              <div style="font-size:14px;font-weight:700;color:${_bc}">${totSelisih>=0?'+':''}${_fmtRp(Math.abs(totSelisih))}</div>
            </div>
          </div>
          <div style="position:relative;background:var(--surface2);height:18px;border-radius:4px;overflow:hidden">
            <div style="position:absolute;inset:0 auto 0 0;width:${Math.min(100,totPct).toFixed(1)}%;background:${_bc};border-radius:4px;transition:width .3s"></div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 7px;pointer-events:none">
              <span style="font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45)">${_bl}</span>
              <span style="font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45)">${totPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>`;
        })() : ''}
      </div>

      <!-- Ringkasan orderan -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4);margin-bottom:var(--s4)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.05em">
              RINGKASAN ORDER — ${_fmtDate(_date)} / ${_shift==='S1'?'Shift 1':'Shift 2&amp;3'}
            </div>
            ${form ? `<span style="font-size:10px;padding:3px 9px;border-radius:20px;font-weight:700;
              background:${form.status==='final'?'rgba(16,185,129,.12)':'rgba(245,158,11,.12)'};
              color:${form.status==='final'?'#10b981':'#f59e0b'}">
              ${form.status==='final'?'✓ Final':'● Draft'}
            </span>` : ''}
          </div>
          ${revenue > 0 && totalPortions > 0 ? `
            <div style="font-size:11px;color:var(--text-3)">
              Omset: ${_fmtRp(revenue)} × ${fcp}%
              = <strong style="color:${budgetOk?'#10b981':'#ef4444'}">${_fmtRp(budgetVal)}</strong>
              &nbsp;|&nbsp; Est HPP: <strong style="color:var(--text)">${_fmtRp(totalEst)}</strong>
            </div>
          ` : ''}
        </div>
        ${summary.length === 0
          ? `<div style="text-align:center;padding:16px;color:var(--text-3);font-size:13px">Tidak ada order untuk tanggal ini</div>`
          : `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
              ${summary.map(c => {
                const sub = (c.meals > 0 && c.snacks > 0)
                  ? `${c.meals} pax ${c.snacks} snack`
                  : c.snacks > 0 ? `${c.snacks} snack` : 'pax';
                return `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:4px 9px;min-width:60px">
                  <div style="font-size:9px;color:var(--text-3);font-weight:600;white-space:nowrap">${c.nama}</div>
                  <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.3">${c.total.toLocaleString('id-ID')}</div>
                  <div style="font-size:9px;color:var(--text-3)">${sub}</div>
                </div>`;
              }).join('')}
            </div>
            <div style="font-weight:700;color:var(--primary);font-size:13px">Total: ${totalPortions.toLocaleString('id-ID')} pax</div>`
        }
        ${budgetVal > 0 && totalEst > 0 ? `
          <div style="margin-top:10px;background:var(--surface2);height:6px;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.min(100,(totalEst/budgetVal*100)).toFixed(1)}%;
              background:${budgetOk?'#10b981':'#ef4444'};border-radius:3px;transition:width .3s"></div>
          </div>
          <div style="font-size:10px;color:var(--text-3);margin-top:4px;text-align:right">
            ${(totalEst/budgetVal*100).toFixed(1)}% dari budget
          </div>
        ` : ''}
      </div>

      <!-- Form produksi table -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:var(--s3) var(--s4);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <span style="font-size:13px;font-weight:700">Form Produksi</span>
            <span style="font-size:11px;color:var(--text-3);margin-left:8px">${items.length} bahan</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${form ? `
              <button onclick="DailyOrderModule.startAddItem()"
                style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer;font-weight:600">+ Tambah Bahan</button>
              <button onclick="DailyOrderModule.toggleStatus()"
                style="padding:6px 12px;border:1px solid ${form.status==='final'?'rgba(245,158,11,.4)':'rgba(16,185,129,.4)'};border-radius:7px;
                background:${form.status==='final'?'rgba(245,158,11,.08)':'rgba(16,185,129,.08)'};
                color:${form.status==='final'?'#f59e0b':'#10b981'};font-size:12px;cursor:pointer;font-weight:600">
                ${form.status==='final'?'↺ Buka Draft':'✓ Finalisasi'}
              </button>
              <button onclick="DailyOrderModule.deleteForm()"
                style="padding:6px 12px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:rgba(239,68,68,.07);color:#ef4444;font-size:12px;cursor:pointer">Hapus</button>
            ` : `
              <button onclick="DailyOrderModule.createForm()"
                style="padding:6px 16px;border:none;border-radius:7px;background:var(--primary);color:#fff;font-size:12px;cursor:pointer;font-weight:600">+ Buat Form Produksi</button>
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
                  ${items.length === 0 && _editingItemId !== 'new'
                    ? `<tr><td colspan="11" style="padding:28px;text-align:center;color:var(--text-3)">
                        <span style="font-size:20px">📦</span>
                        <div style="margin-top:8px;font-size:13px;font-weight:600">Belum ada bahan ditambahkan</div>
                        <div style="font-size:11px;margin-top:2px">Klik "+ Tambah Bahan" untuk menambah bahan produksi</div>
                       </td></tr>`
                    : items.map((it,i) => it.id === _editingItemId ? _htmlEditRow(it,i) : _htmlItemRow(it,i)).join('') +
                      (_editingItemId === 'new' ? _htmlEditRow(null, items.length) : '')
                  }
                </tbody>
                ${items.length > 0 ? (() => {
                  const _sumEst = f => (f?.items||[]).reduce((s,it) => s + _n(it.estTotal), 0);
                  const _sumAkt = f => (f?.items||[]).reduce((s,it) => s + _n(it.aktTotal), 0);
                  const totEstAll = _sumEst(formS1) + _sumEst(formS2);
                  const totAktAll = _sumAkt(formS1) + _sumAkt(formS2);
                  const selEst = totBudget > 0 ? totBudget - totEstAll : null;
                  const selAkt = totBudget > 0 ? totBudget - totAktAll : null;
                  const _selCell = (v, label) => v === null ? `<td style="padding:9px 5px"></td>` : `
                    <td style="padding:9px 5px;text-align:right;white-space:nowrap">
                      <div style="font-size:9px;color:var(--text-3);font-weight:600">${label}</div>
                      <div style="font-size:11px;font-weight:700;color:${v>=0?'#10b981':'#ef4444'}">
                        ${v>=0?'+':''}${v.toLocaleString('id-ID')}
                      </div>
                    </td>`;
                  return `
                  <tfoot>
                    <tr style="background:var(--surface2);border-top:2px solid var(--border);font-weight:700">
                      <td colspan="5" style="padding:9px 5px;text-align:right;color:var(--text-3);font-size:10px;letter-spacing:.03em">TOTAL ESTIMASI</td>
                      <td style="padding:9px 5px;text-align:right;color:#6366f1">${totalEst.toLocaleString('id-ID')}</td>
                      <td style="padding:9px 5px;text-align:right;color:var(--text-3);font-size:10px">AKTUAL</td>
                      <td style="padding:9px 5px;text-align:right;color:#10b981">${totalAkt.toLocaleString('id-ID')}</td>
                      <td style="padding:9px 5px"></td>
                      ${_selCell(selEst, 'SISA EST')}
                      ${_selCell(selAkt, 'SISA AKT')}
                    </tr>
                  </tfoot>`;
                })() : ''}
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
        // Use aktQty if explicitly set (including 0), else fall back to estQty
        const qty   = (it.aktQty !== null && it.aktQty !== undefined && it.aktQty !== '') ? _n(it.aktQty) : _n(it.estQty);
        const value = (it.aktTotal != null && it.aktTotal !== '') ? _n(it.aktTotal) : _n(it.estTotal);
        itemMap[it.item].totalQty   += qty;
        itemMap[it.item].totalValue += value;
        itemMap[it.item].days++;
      });
    });
    const items      = Object.values(itemMap).sort((a,b) => b.totalValue - a.totalValue);
    const grandTotal = items.reduce((s,it) => s + it.totalValue, 0);
    const totalForms = _forms.length;
    const activeDays = new Set(_forms.map(f => f.tanggal)).size;

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${[
          {label:'Total Form',  value:totalForms,         unit:'form',  color:'#6366f1'},
          {label:'Hari Aktif',  value:activeDays,         unit:'hari',  color:'#10b981'},
          {label:'Total Item',  value:items.length,       unit:'bahan', color:'#8b5cf6'},
          {label:'Total Nilai', value:_fmtRp(grandTotal), unit:'',      color:'#f59e0b'},
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4)">
            <div style="font-size:11px;color:var(--text-3);font-weight:600">${s.label}</div>
            <div style="font-size:20px;font-weight:700;color:${s.color};margin-top:4px">${s.value}</div>
            ${s.unit ? `<div style="font-size:11px;color:var(--text-3)">${s.unit}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:var(--s4);border-bottom:1px solid var(--border)">
          <span style="font-size:13px;font-weight:700">Penggunaan Bahan Terbesar</span>
          <span style="font-size:11px;color:var(--text-3);margin-left:8px">${items.length} item</span>
        </div>
        ${items.length === 0
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
                    <th style="padding:8px;text-align:right;color:var(--text-3)">% DARI TOTAL</th>
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
      selisih     : it.totalAkt - it.totalEst,
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
        ${rows.length === 0
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
                    const ok   = Math.abs(r.selisih) < 0.001;
                    const over = r.selisih > 0.001;
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
    const [yr, mo] = _summaryMonth.split('-').map(Number);
    const monthLabel  = new Date(yr, mo-1, 1).toLocaleDateString('id-ID',{month:'long',year:'numeric'});
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const prevM = _adjMonth(_summaryMonth,-1);
    const nextM = _adjMonth(_summaryMonth,+1);

    const monthOrds = _orders.filter(o => o.tglOrder && o.tglOrder.slice(0,7) === _summaryMonth);

    function _ordMeals(o)  { return _n(o.breakfast)+_n(o.shift1)+_n(o.spare1)+_n(o.ot1)+_n(o.shift2)+_n(o.spare2)+_n(o.ot2)+_n(o.shift3)+_n(o.spare3)+_n(o.ot3); }
    function _ordSnacks(o) { return _n(o.snack1)+_n(o.snack2)+_n(o.snack3)+_n(o.snackBerat); }

    const custVol = {};
    monthOrds.forEach(o => {
      custVol[o.namaPerusahaan] = (custVol[o.namaPerusahaan]||0) + _ordMeals(o) + _ordSnacks(o);
    });
    const customers = Object.keys(custVol).sort((a,b) => custVol[b]-custVol[a]);

    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${_summaryMonth}-${String(d).padStart(2,'0')}`;
      const dayOrds = monthOrds.filter(o => o.tglOrder === dateStr);
      const cells = {};
      let totMeals = 0, totSnacks = 0;
      dayOrds.forEach(o => {
        const m = _ordMeals(o), s = _ordSnacks(o);
        cells[o.namaPerusahaan] = (cells[o.namaPerusahaan]||0) + m + s;
        totMeals += m; totSnacks += s;
      });
      rows.push({dateStr, d, cells, totMeals, totSnacks, hasData: dayOrds.length > 0});
    }

    const custTotals = {};
    let grandMeals = 0, grandSnacks = 0;
    rows.forEach(r => {
      customers.forEach(c => { custTotals[c] = (custTotals[c]||0) + (r.cells[c]||0); });
      grandMeals  += r.totMeals;
      grandSnacks += r.totSnacks;
    });
    const activeDays = rows.filter(r => r.hasData).length;

    const statsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${[
          {label:'Hari Aktif',    value:activeDays,                                       unit:'hari',  color:'#6366f1'},
          {label:'Total Porsi',   value:(grandMeals+grandSnacks).toLocaleString('id-ID'), unit:'porsi', color:'#10b981'},
          {label:'Total Makanan', value:grandMeals.toLocaleString('id-ID'),               unit:'porsi', color:'#8b5cf6'},
          {label:'Total Snack',   value:grandSnacks.toLocaleString('id-ID'),              unit:'porsi', color:'#f59e0b'},
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4)">
            <div style="font-size:11px;color:var(--text-3);font-weight:600">${s.label}</div>
            <div style="font-size:20px;font-weight:700;color:${s.color};margin-top:4px">${s.value}</div>
            ${s.unit ? `<div style="font-size:11px;color:var(--text-3)">${s.unit}</div>` : ''}
          </div>
        `).join('')}
      </div>`;

    if (customers.length === 0) return statsHtml + `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:48px;text-align:center;color:var(--text-3)">
        <div style="font-size:32px;margin-bottom:10px">📅</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px">Tidak ada order untuk bulan ini</div>
      </div>`;

    const cell = v => v
      ? `<td style="padding:6px 5px;text-align:right;font-weight:600">${v.toLocaleString('id-ID')}</td>`
      : `<td style="padding:6px 5px;text-align:center;color:var(--border)">-</td>`;

    return statsHtml + `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
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
              <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                <th style="padding:7px 8px;text-align:left;color:var(--text-3);font-weight:700;white-space:nowrap;border-right:1px solid var(--border)">TANGGAL</th>
                ${customers.map(c => `<th style="padding:7px 5px;text-align:right;color:var(--primary);font-weight:600;white-space:nowrap;font-size:10px">${c}</th>`).join('')}
                <th style="padding:7px 5px;text-align:right;color:#10b981;font-weight:700;white-space:nowrap;border-left:1px solid var(--border)">JUMLAH<br><span style="font-size:9px;font-weight:400">(Makan+Snack)</span></th>
                <th style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:700;white-space:nowrap">JUMLAH<br><span style="font-size:9px;font-weight:400">(Makanan)</span></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r,i) => {
                const isToday = r.dateStr === _today();
                const dow = new Date(r.dateStr+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short'});
                const isSun = new Date(r.dateStr+'T00:00:00').getDay() === 0;
                return `
                <tr style="border-bottom:1px solid var(--border);
                  ${isToday?'background:rgba(99,102,241,.06);font-weight:700;':isSun?'background:rgba(239,68,68,.03);':i%2?'background:rgba(0,0,0,.015)':''}">
                  <td style="padding:6px 8px;font-size:11px;white-space:nowrap;border-right:1px solid var(--border);color:${isSun?'#ef4444':'var(--text)'}">
                    <strong style="color:${isToday?'var(--primary)':'inherit'}">${String(r.d).padStart(2,'0')}</strong>
                    <span style="color:var(--text-3);margin-left:4px;font-size:10px">${dow}</span>
                    ${isToday?`<span style="font-size:9px;background:rgba(99,102,241,.15);color:var(--primary);padding:1px 5px;border-radius:8px;margin-left:4px;font-weight:700">HARI INI</span>`:''}
                  </td>
                  ${customers.map(c => cell(r.cells[c]||0)).join('')}
                  <td style="padding:6px 5px;text-align:right;font-weight:700;border-left:1px solid var(--border);color:${r.hasData?'#10b981':'var(--border)'}">
                    ${r.hasData?(r.totMeals+r.totSnacks).toLocaleString('id-ID'):'-'}
                  </td>
                  <td style="padding:6px 5px;text-align:right;font-weight:700;color:${r.hasData?'#6366f1':'var(--border)'}">
                    ${r.hasData?r.totMeals.toLocaleString('id-ID'):'-'}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface2);border-top:2px solid var(--border);font-weight:700">
                <td style="padding:8px;color:var(--text-3);font-size:11px;border-right:1px solid var(--border)">TOTAL</td>
                ${customers.map(c => `<td style="padding:8px 5px;text-align:right;color:var(--primary)">${custTotals[c]?custTotals[c].toLocaleString('id-ID'):'-'}</td>`).join('')}
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
    const sumber = it.sumber || _calcSumber(_n(it.stokGudang), _n(it.aktQty));
    return `
      <tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.018)':''};cursor:pointer" ondblclick="DailyOrderModule.startEditItem('${it.id}',event.target.closest('td')?.dataset?.field)" title="Double-klik untuk edit">
        <td style="padding:7px 5px;text-align:center;color:var(--text-3)">${i+1}</td>
        <td data-field="di-item" style="padding:7px 5px;font-weight:600">${it.item}</td>
        <td data-field="di-estqty" style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:600">${it.estQty||'-'}</td>
        <td data-field="di-item" style="padding:7px 5px;text-align:center;color:var(--text-3)">${it.satuan||'-'}</td>
        <td data-field="di-harga" style="padding:7px 5px;text-align:right;color:var(--text-3)">${_n(it.hargaSatuan)?_n(it.hargaSatuan).toLocaleString('id-ID'):'-'}</td>
        <td data-field="di-harga" style="padding:7px 5px;text-align:right;color:#6366f1">${_n(it.estTotal)?_n(it.estTotal).toLocaleString('id-ID'):'-'}</td>
        <td data-field="di-aktqty" style="padding:7px 5px;text-align:right;color:#10b981;font-weight:600">${it.aktQty||'-'}</td>
        <td data-field="di-aktqty" style="padding:7px 5px;text-align:right;color:#10b981">${_n(it.aktTotal)?_n(it.aktTotal).toLocaleString('id-ID'):'-'}</td>
        <td data-field="di-aktqty" style="padding:7px 5px;text-align:center">
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;
            background:${sumber==='PASAR'?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)'};
            color:${sumber==='PASAR'?'#ef4444':'#10b981'}">${sumber}</span>
        </td>
        <td data-field="di-catatan" style="padding:7px 5px;color:var(--text-3);font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis">${it.catatan||''}</td>
        <td style="padding:7px 5px;text-align:center;white-space:nowrap">
          <button onclick="DailyOrderModule.startEditItem('${it.id}')" title="Edit"
            style="width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:11px">✎</button>
          <button onclick="DailyOrderModule.deleteItem('${it.id}')" title="Hapus"
            style="width:22px;height:22px;border-radius:4px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;font-size:11px;margin-left:2px">✕</button>
        </td>
      </tr>`;
  }

  function _htmlEditRow(it, idx) {
    const harga0 = _n(it?.hargaSatuan);
    const estQ0  = _n(it?.estQty);
    const aktQ0  = _n(it?.aktQty);
    const stok0  = _n(it?.stokGudang);
    const sumb0  = _calcSumber(stok0, aktQ0);
    const isNew  = !it;
    const inp    = p => `padding:3px 5px;font-size:11px;${p}`;
    return `
      <tr style="border-bottom:1px solid var(--border);background:rgba(99,102,241,.04)">
        <td style="padding:4px 3px;text-align:center;color:var(--primary);font-size:11px;font-weight:700">${isNew?'✦':idx+1}</td>
        <td style="padding:4px 3px;min-width:140px">
          <input type="hidden" id="di-stok" value="${stok0}">
          <input id="di-item" class="form-control" style="${inp('min-width:120px')}"
            placeholder="Nama bahan..." value="${it?.item||''}"
            onchange="DailyOrderModule._autoFillFromInventory();DailyOrderModule._liveCompute()"
            onkeydown="DailyOrderModule._editKeyDown(event,'di-estqty')">
        </td>
        <td style="padding:4px 3px">
          <input id="di-estqty" class="form-control" style="${inp('text-align:right;width:60px')}"
            type="number" step="0.01" min="0" placeholder="0" value="${estQ0||''}"
            oninput="DailyOrderModule._liveCompute()"
            onkeydown="DailyOrderModule._estQtyKeyDown(event)">
        </td>
        <td style="padding:4px 6px;text-align:center">
          <input type="hidden" id="di-sat" value="${it?.satuan||''}">
          <span id="di-sat-d" style="font-size:11px;color:var(--text-3)">${it?.satuan||'-'}</span>
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
            onkeydown="DailyOrderModule._aktQtyKeyDown(event)">
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
    const stok   = parseFloat(document.getElementById('di-stok')?.value||0)||0;
    const harga  = parseFloat(document.getElementById('di-harga')?.value||0)||0;
    const sumber = _calcSumber(stok, aktQty);
    const $ = id => document.getElementById(id);
    if ($('di-esttot-d')) $('di-esttot-d').textContent = estQty&&harga ? (estQty*harga).toLocaleString('id-ID') : '-';
    if ($('di-akttot-d')) $('di-akttot-d').textContent = aktQty&&harga ? (aktQty*harga).toLocaleString('id-ID') : '-';
    if ($('di-sumb-d'))   {
      $('di-sumb-d').textContent         = sumber;
      $('di-sumb-d').style.background    = sumber==='PASAR'?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)';
      $('di-sumb-d').style.color         = sumber==='PASAR'?'#ef4444':'#10b981';
    }
  }

  /* Auto-fill satuan/harga/stok from inventory when item selected */
  function _autoFillFromInventory() {
    if (!_inventory.length) return;
    const inputEl = document.getElementById('di-item');
    const val = inputEl?.value.trim().toLowerCase();
    if (!val) { if (inputEl) inputEl.style.borderColor = ''; return; }
    const inv = _inventory.find(i => (i.nama||'').toLowerCase() === val);
    if (inputEl) inputEl.style.borderColor = inv ? '#10b981' : '#ef4444';
    if (!inv) return;
    const hargaEl   = document.getElementById('di-harga');
    const stokEl    = document.getElementById('di-stok');
    const satHidden = document.getElementById('di-sat');
    const satDisplay= document.getElementById('di-sat-d');
    if (inv.satuan) {
      if (satHidden)  satHidden.value       = inv.satuan;
      if (satDisplay) satDisplay.textContent = inv.satuan;
    }
    if (hargaEl) hargaEl.value = inv.hargaSatuan || 0;
    if (stokEl)  stokEl.value  = inv._stok || 0;
    _liveCompute();
  }

  /* Enter on EST QTY: if ITEM filled → save; else move to HARGA */
  function _estQtyKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); _cancelEdit(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = document.getElementById('di-item')?.value.trim();
      if (item) _saveEditRow();
      else      document.getElementById('di-item')?.focus();
    }
  }

  /* Enter on AKT QTY: save + jump to next row's aktqty */
  function _aktQtyKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); _cancelEdit(); return; }
    if (e.key === 'Enter')  { e.preventDefault(); _saveEditRow('di-aktqty'); }
  }

  /* Tab/Enter key navigation between inline inputs */
  function _editKeyDown(e, nextId) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextId) document.getElementById(nextId)?.focus();
      else        _saveEditRow();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      _cancelEdit();
    }
  }

  /* Save inline edit row — guarded against double-save */
  async function _saveEditRow(jumpToField) {
    if (_saving) return;
    const form = _currentForm();
    if (!form) return;
    const item = document.getElementById('di-item')?.value.trim();
    if (!item) { Notify.warning('Nama bahan wajib diisi'); document.getElementById('di-item')?.focus(); return; }
    if (_inventory.length) {
      const inInv = _inventory.some(i => (i.nama||'').toLowerCase() === item.toLowerCase());
      if (!inInv) {
        Notify.warning(`"${item}" tidak ada di stok — pilih dari daftar`);
        const el = document.getElementById('di-item');
        if (el) { el.style.borderColor = '#ef4444'; el.focus(); }
        return;
      }
    }
    const estQty  = parseFloat(document.getElementById('di-estqty')?.value||0)||0;
    const satuan  = document.getElementById('di-sat')?.value || '';
    const harga   = parseFloat(document.getElementById('di-harga')?.value||0)||0;
    const aktQty  = parseFloat(document.getElementById('di-aktqty')?.value||0)||0;
    const stokGud = parseFloat(document.getElementById('di-stok')?.value||0)||0;
    const catatan = document.getElementById('di-catatan')?.value.trim()||'';
    const sumber  = _calcSumber(stokGud, aktQty);
    const data    = { item, estQty, satuan, hargaSatuan:harga, aktQty, stokGudang:stokGud, sumber, catatan,
                      estTotal: estQty*harga, aktTotal: aktQty*harga };

    const editingId = _editingItemId !== 'new' ? _editingItemId : null;
    const wasNew = _editingItemId === 'new';
    if (wasNew) {
      form.items.push({ id: 'item_' + Utils.uid(), ...data });
    } else {
      const it = (form.items||[]).find(i => i.id === _editingItemId);
      if (it) Object.assign(it, data);
      else    { Notify.error('Item tidak ditemukan'); return; }
    }
    form.updatedAt = new Date().toISOString();

    _saving = true;
    try {
      await DB.saveDailyOrderForm(form);
      // After saving existing item → return to view; after adding new → stay in 'new' mode
      _editingItemId = wasNew ? 'new' : null;
      _renderContent();
      if (!wasNew) {
        Notify.success('Bahan diperbarui');
        if (jumpToField && editingId) {
          const _ni = form.items.findIndex(i => i.id === editingId);
          const _nxt = form.items[_ni + 1];
          if (_nxt) setTimeout(() => startEditItem(_nxt.id, jumpToField), 60);
        }
      }
      if (wasNew) setTimeout(() => { _initItemCombo(); document.getElementById('di-item')?.focus(); }, 60);
    } catch(e) {
      console.error('[DO] saveRow:', e);
      Notify.error('Gagal menyimpan bahan, coba lagi');
      // Rollback local change
      if (wasNew) form.items.pop();
    } finally {
      _saving = false;
    }
  }

  function _cancelEdit() { _editingItemId = null; _renderContent(); }

  /* ─── ACTIONS ─── */
  function setView(v) {
    _view = v;
    const page = document.getElementById('page-daily-order');
    if (page) _renderFull(page);
  }

  function setDate(d) {
    _editingItemId = null;
    _date          = d;
    _formMonth     = d.slice(0,7);
    _renderContent();
  }
  function setFormMonth(m) {
    _editingItemId = null;
    _formMonth     = m;
    if (!_date.startsWith(m)) _date = m + '-01';
    _renderContent();
  }
  function prevFormMonth() { setFormMonth(_adjMonth(_formMonth,-1)); }
  function nextFormMonth() { setFormMonth(_adjMonth(_formMonth,+1)); }
  function setShift(s) {
    _editingItemId = null;
    _shift         = s;
    _renderContent();
  }
  function setMonth(m) { _summaryMonth = m; _renderContent(); }

  async function createForm() {
    // Guard: don't create if already exists
    if (_currentForm()) { Notify.warning('Form sudah ada untuk tanggal dan shift ini'); return; }
    const form = {
      id          : 'do_' + _date.replace(/-/g,'') + '_' + _shift,
      tanggal     : _date,
      shift       : _shift,
      budgetBelanja: 0,
      foodCostPct  : _DEFAULT_FCP,
      items        : [],
      status       : 'draft',
      createdAt    : new Date().toISOString(),
      updatedAt    : new Date().toISOString(),
    };
    try {
      await DB.saveDailyOrderForm(form);
      _forms.push(form); // only push after DB confirms
      _renderContent();
      Notify.success('Form produksi dibuat');
    } catch(e) {
      console.error('[DO] createForm:', e);
      Notify.error('Gagal membuat form, coba lagi');
    }
  }

  async function toggleStatus() {
    const form = _currentForm();
    if (!form) return;
    const prevStatus = form.status;
    form.status    = form.status === 'final' ? 'draft' : 'final';
    form.updatedAt = new Date().toISOString();
    try {
      await DB.saveDailyOrderForm(form);
      _renderContent();
      Notify.success(form.status === 'final' ? 'Form difinalisasi' : 'Form dibuka kembali');
    } catch(e) {
      console.error('[DO] toggleStatus:', e);
      form.status = prevStatus; // rollback
      Notify.error('Gagal mengubah status');
    }
  }

  async function deleteForm() {
    const form = _currentForm();
    if (!form) return;
    const ok = await Modal.confirm({
      title      : 'Hapus Form Produksi',
      message    : `Hapus form produksi <strong>${_fmtDate(form.tanggal)} / ${form.shift}</strong> beserta semua bahannya?`,
      confirmText: 'Hapus',
      danger     : true,
    });
    if (!ok) return;
    _editingItemId = null;
    try {
      await DB.deleteDailyOrderForm(form.id);
      _forms = _forms.filter(f => f.id !== form.id); // only remove after DB confirms
      _renderContent();
      Notify.success('Form dihapus');
    } catch(e) {
      console.error('[DO] deleteForm:', e);
      Notify.error('Gagal menghapus form, coba lagi');
    }
  }

  async function updateFormMeta(field, value) {
    if (!_ALLOWED_META_FIELDS.has(field)) {
      console.warn('[DO] updateFormMeta: field not allowed:', field);
      return;
    }
    const form = _currentForm();
    if (!form) return;
    const prev = form[field];
    form[field]    = value;
    form.updatedAt = new Date().toISOString();
    try {
      await DB.saveDailyOrderForm(form);
      _renderContent();
    } catch(e) {
      console.error('[DO] updateFormMeta:', e);
      form[field] = prev; // rollback
      Notify.error('Gagal menyimpan perubahan');
    }
  }

  function _initItemCombo() {
    const el = document.getElementById('di-item');
    if (!el || el._comboInit) return;
    el._comboInit = true;
    const names = [...new Set(_inventory.map(i => i.nama).filter(Boolean))].sort();
    // Frequency: count how many times each item name appears across all form items
    const freq = {};
    _forms.forEach(f => (f.items || []).forEach(it => {
      if (it.item) freq[it.item] = (freq[it.item] || 0) + 1;
    }));
    Utils.initCombo(el, names, {
      onSelect: () => { _autoFillFromInventory(); _liveCompute(); },
      frequency: freq,
    });
  }

  function startAddItem() {
    const form = _currentForm();
    if (!form) { Notify.warning('Buat form produksi dulu'); return; }
    _editingItemId = 'new';
    _renderContent();
    setTimeout(() => { _initItemCombo(); document.getElementById('di-item')?.focus(); }, 60);
  }

  function startEditItem(itemId, focusField) {
    _editingItemId = itemId;
    _renderContent();
    setTimeout(() => { _initItemCombo(); document.getElementById(focusField || 'di-item')?.focus(); }, 60);
  }

  async function deleteItem(itemId) {
    const form = _currentForm();
    if (!form) return;
    const it = (form.items||[]).find(i => i.id === itemId);
    if (!it) return;
    const ok = await Modal.confirm({
      title      : 'Hapus Bahan',
      message    : `Hapus <strong>${it.item}</strong> dari form ini?`,
      confirmText: 'Hapus',
      danger     : true,
    });
    if (!ok) return;
    _editingItemId  = null;
    const prevItems = form.items;
    form.items     = form.items.filter(i => i.id !== itemId);
    form.updatedAt = new Date().toISOString();
    try {
      await DB.saveDailyOrderForm(form);
      _renderContent();
      Notify.success('Bahan dihapus');
    } catch(e) {
      console.error('[DO] deleteItem:', e);
      form.items = prevItems; // rollback
      Notify.error('Gagal menghapus bahan');
    }
  }

  function goToDate(date) {
    _editingItemId = null;
    _date          = date;
    _formMonth     = date.slice(0,7);
    _view          = 'form';
    const page = document.getElementById('page-daily-order');
    if (page) _renderFull(page);
  }

  /* ─── PUBLIC API ─── */
  return {
    init, setView, setDate, setShift, setMonth,
    setFormMonth, prevFormMonth, nextFormMonth,
    createForm, toggleStatus, deleteForm, updateFormMeta,
    startAddItem, startEditItem, deleteItem, goToDate,
    _saveEditRow, _cancelEdit, _editKeyDown, _estQtyKeyDown, _aktQtyKeyDown,
    _liveCompute, _autoFillFromInventory,
  };
})();

window.DailyOrderModule = DailyOrderModule;
