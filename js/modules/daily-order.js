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
  let _bulkSelected = new Set();

  /* ─── CONSTANTS ─── */
  const _SATS        = ['Kg','Pcs','Liter','Pack','Bal','Ikat','Bks','Lusin','Karton','Gram','ML'];
  const _DAY_LABELS  = ['Mg','Sn','Sl','Rb','Km','Jm','Sb'];
  let _DEFAULT_FCP = 54; // default food cost % — overridden by settings
  let _SNACK_FCP = 70;   // default snack cost %
  let _SNACK_BERAT_FCP = 65; // default snack berat cost %
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
    return 'Rp\u00a0' + Math.round(Number(n)).toLocaleString('id-ID');
  }

  function _n(v) { return Number(v) || 0; }

  /* Shift display label and type helpers */
  function _shiftLabel(s) {
    return {S1:'Shift 1', S2:'Shift 2&3', SNK1:'Snack S1', SNK2:'Snack S2', SNK3:'Snack S3', SNK4:'Snack Berat'}[s] || s;
  }
  function _isSnack(s) { return s === 'SNK1' || s === 'SNK2' || s === 'SNK3' || s === 'SNK4'; }
  function _defaultFcp(shift) {
    if (shift === 'SNK4') return _SNACK_BERAT_FCP;
    if (_isSnack(shift)) return _SNACK_FCP;
    return _DEFAULT_FCP;
  }

  /* ── Sumber: compare accumulated demand vs inventory stock ── */
  // Per-form sumber: uses a running stock tracker across ALL forms
  function _calcAllSumber() {
    const stockMap = {};
    _inventory.forEach(inv => {
      stockMap[inv.nama.toLowerCase().trim()] = inv._stok || 0;
    });
    const running = {};
    Object.keys(stockMap).forEach(k => { running[k] = stockMap[k]; });

    // Only process forms from last 7 days — older forms already synced to inventory
    // This prevents O(n*m) explosion as data grows
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');

    const sorted = [..._forms]
      .filter(f => (f.tanggal||'') >= cutoffStr)
      .sort((a,b) => {
        const d = (a.tanggal||'').localeCompare(b.tanggal||'');
        return d !== 0 ? d : (a.shift||'').localeCompare(b.shift||'');
      });

    sorted.forEach(form => {
      (form.items || []).forEach(it => {
        if (!it.item) return;
        const key = it.item.toLowerCase().trim();
        const qty = Number(it.estQty) || Number(it.aktQty) || 0;
        if (qty <= 0) { it.sumber = 'STOK'; return; }
        if (!(key in running)) running[key] = 0;
        const avail = running[key];
        if (avail <= 0)       it.sumber = 'PASAR';
        else if (avail >= qty) it.sumber = 'STOK';
        else                   it.sumber = 'PARTIAL';
        it.stokGudang = Math.max(0, avail);
        running[key] -= qty;
      });
    });
  }

  // Simple version for single-item quick check (used in edit row live preview)
  function _calcSumber(stokGudang, aktQty) {
    if (!aktQty || aktQty <= 0) return 'STOK';
    if (!stokGudang || stokGudang <= 0) return 'PASAR';
    if (stokGudang >= aktQty) return 'STOK';
    return 'PARTIAL';
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

  // Resolve nama order ke nama customer (handle mismatch seperti SUPER STEEL KARAWANG vs PT. Super Steel Karawang)
  function _resolveName(orderName) {
    orderName = (orderName||'').trim(); if (!orderName) return orderName;
    const low = orderName.toLowerCase();
    // Exact match
    let c = _customers.find(x => (x.nama||'').toLowerCase() === low);
    if (c) return c.nama;
    // Contains match (order name is substring of customer name or vice versa)
    c = _customers.find(x => (x.nama||'').toLowerCase().includes(low) || low.includes((x.nama||'').toLowerCase()));
    if (c) return c.nama;
    // Match via namaShort
    c = _customers.find(x => (x.namaShort||'').toLowerCase() === low);
    if (c) return c.nama;
    return orderName;
  }

  // Lookup nama singkat customer (fallback ke nama lengkap)
  function _shortName(fullName) {
    const resolved = _resolveName(fullName);
    const c = _customers.find(x => (x.nama||'').toLowerCase() === (resolved||'').toLowerCase());
    return c?.namaShort || resolved || '-';
  }

  /* ─── ORDER SUMMARY ─── */
  function _getOrderSummary(date, shift) {
    const dayOrds = _orders.filter(o => o.tglOrder === date);
    const out = [];
    dayOrds.forEach(o => {
      let meals = 0, snacks = 0;
      if      (shift === 'S1')   { meals  = _n(o.breakfast) + _n(o.shift1) + _n(o.spare1) + _n(o.ot1); }
      else if (shift === 'S2')   { meals  = _n(o.shift2) + _n(o.spare2) + _n(o.ot2) + _n(o.shift3) + _n(o.spare3) + _n(o.ot3); }
      else if (shift === 'SNK1') { snacks = _n(o.snack1); }
      else if (shift === 'SNK2') { snacks = _n(o.snack2); }
      else if (shift === 'SNK3') { snacks = _n(o.snack3); }
      else if (shift === 'SNK4') { snacks = _n(o.snackBerat); }
      if (meals + snacks > 0) out.push({ nama: _resolveName(o.namaPerusahaan), meals, snacks, total: meals + snacks });
    });
    return out.sort((a,b) => b.total - a.total);
  }

  /* Revenue = Σ(qty × harga customer) per shift */
  function _calcRevenue(date, shift) {
    const dayOrds = _orders.filter(o => o.tglOrder === date);
    let total = 0;
    dayOrds.forEach(o => {
      const resolved = _resolveName(o.namaPerusahaan);
      const c = _customers.find(x => (x.nama||'').toLowerCase() === (resolved||'').toLowerCase()) || {};
      let gross = 0;
      let qty = 0;
      if (shift === 'S1') {
        gross += _n(o.breakfast) * _n(c.hargaBreakfast || c.hargaShift1);
        gross += _n(o.shift1)   * _n(c.hargaShift1);
        gross += _n(o.spare1)   * _n(c.hargaSpare1);
        gross += _n(o.ot1)      * _n(c.hargaOT1 || c.hargaShift1);
        qty = _n(o.breakfast) + _n(o.shift1) + _n(o.spare1) + _n(o.ot1);
      } else if (shift === 'S2') {
        gross += _n(o.shift2)   * _n(c.hargaShift2);
        gross += _n(o.spare2)   * _n(c.hargaSpare2);
        gross += _n(o.ot2)      * _n(c.hargaOT2 || c.hargaShift2);
        gross += _n(o.shift3)   * _n(c.hargaShift3);
        gross += _n(o.spare3)   * _n(c.hargaSpare3);
        gross += _n(o.ot3)      * _n(c.hargaOT3 || c.hargaShift3);
        qty = _n(o.shift2) + _n(o.spare2) + _n(o.ot2) + _n(o.shift3) + _n(o.spare3) + _n(o.ot3);
      } else if (shift === 'SNK1') {
        gross += _n(o.snack1)   * _n(c.hargaSnack1);
        qty = _n(o.snack1);
      } else if (shift === 'SNK2') {
        gross += _n(o.snack2)   * _n(c.hargaSnack2);
        qty = _n(o.snack2);
      } else if (shift === 'SNK3') {
        gross += _n(o.snack3)   * _n(c.hargaSnack3);
        qty = _n(o.snack3);
      } else if (shift === 'SNK4') {
        gross += _n(o.snackBerat) * _n(c.hargaSnackBerat);
        qty = _n(o.snackBerat);
      }
      // Potongan: PPH23 semua shift, biaya box & lainnya hanya meal shifts (bukan snack)
      const isSnkShift = shift==='SNK1'||shift==='SNK2'||shift==='SNK3'||shift==='SNK4';
      const pphDed   = c.pph23 ? Math.round(gross * 0.02) : 0;
      const boxDed   = isSnkShift ? 0 : _n(c.biayaBox) * qty;
      const otherDed = isSnkShift ? 0 : _n(c.biayaLainnya) * qty;
      total += gross - pphDed - boxDed - otherDed;
    });
    return total;
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-daily-order');
    if (!page) return;
    // Load food cost defaults from settings
    try {
      const cfg = await DB.getSettings().catch(()=>({}));
      if (cfg.defaultFoodCostPct)      _DEFAULT_FCP     = parseFloat(cfg.defaultFoodCostPct) || 54;
      if (cfg.defaultSnackCostPct)     _SNACK_FCP       = parseFloat(cfg.defaultSnackCostPct) || 70;
      if (cfg.defaultSnackBeratCostPct) _SNACK_BERAT_FCP = parseFloat(cfg.defaultSnackBeratCostPct) || 65;
    } catch {}
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
      // Compute sumber for ALL items across ALL forms (accumulated stock)
      _calcAllSumber();
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
    if (_view === 'form') {
      // Auto-select text on focus for edit inputs
      document.querySelectorAll('#do-content .form-control').forEach(el => {
        el.addEventListener('focus', () => { if (el.select) el.select(); }, {once:false});
      });
    }
  }

  /* ─── FORM PRODUKSI ─── */
  function _htmlFormProduksi() {
    const summary      = _getOrderSummary(_date, _shift);
    const totalPortions= summary.reduce((s,c) => s + c.total, 0);
    const _dayOrds = _orders.filter(o => o.tglOrder === _date);
    let totalLauk = 0, totalPendamping = 0;
    if (!_isSnack(_shift)) {
      _dayOrds.forEach(o => {
        const resolved = _resolveName(o.namaPerusahaan);
        const c = _customers.find(x => (x.nama||'').toLowerCase() === (resolved||'').toLowerCase()) || {};
        const qL = _n(c.qtyLauk), qP = _n(c.qtyPendamping);
        const pax = _shift === 'S1'
          ? _n(o.breakfast) + _n(o.shift1) + _n(o.spare1) + _n(o.ot1)
          : _n(o.shift2) + _n(o.spare2) + _n(o.ot2) + _n(o.shift3) + _n(o.spare3) + _n(o.ot3);
        totalLauk += qL * pax;
        totalPendamping += qP * pax;
      });
    }
    const form         = _currentForm();
    const items        = form ? (form.items || []) : [];
    // Auto-sync harga dari inventory jika item belum punya harga
    if (items.length && _inventory.length) {
      let needSave = false;
      items.forEach(it => {
        if (_n(it.hargaSatuan)) return; // sudah ada harga
        const inv = _inventory.find(i => (i.nama||'').toLowerCase() === (it.item||'').toLowerCase());
        if (inv && inv.hargaSatuan) {
          it.hargaSatuan = inv.hargaSatuan;
          it.estTotal = _n(it.estQty) * _n(inv.hargaSatuan);
          if (_n(it.aktQty)) it.aktTotal = _n(it.aktQty) * _n(inv.hargaSatuan);
          needSave = true;
        }
      });
      if (needSave && form) DB.saveDailyOrderForm(form).catch(()=>{});
    }
    const totalEst     = items.reduce((s,it) => s + _n(it.estTotal), 0);
    const totalAkt     = items.reduce((s,it) => s + _n(it.aktTotal), 0);

    // Per-shift budget — auto-correct old generic default (54) on snack shifts
    const _savedFcp  = form?.foodCostPct;
    const fcp        = (_savedFcp != null && !(_savedFcp === _DEFAULT_FCP && _isSnack(_shift)))
                       ? _n(_savedFcp) : _defaultFcp(_shift);
    const revenue    = _calcRevenue(_date, _shift);
    const budgetVal  = revenue > 0 ? revenue * fcp / 100 : _n(form?.budgetBelanja);
    const budgetOk   = budgetVal <= 0 || totalEst <= budgetVal;
    // Persist computed budget agar bisa diakses dari modul lain (inventory sync)
    if (form && budgetVal > 0) form._budget = Math.round(budgetVal);

    // Total daily budget card — all shifts combined for selected date
    const formS1     = _forms.find(f => f.tanggal === _date && f.shift === 'S1');
    const formS2     = _forms.find(f => f.tanggal === _date && f.shift === 'S2');
    const formSNK1   = _forms.find(f => f.tanggal === _date && f.shift === 'SNK1');
    const formSNK2   = _forms.find(f => f.tanggal === _date && f.shift === 'SNK2');
    const formSNK3   = _forms.find(f => f.tanggal === _date && f.shift === 'SNK3');
    const formSNK4   = _forms.find(f => f.tanggal === _date && f.shift === 'SNK4');
    const _fcpRev = (frm, sh) => {
      const rev = _calcRevenue(_date, sh);
      const fcp = (frm?.foodCostPct != null ? _n(frm.foodCostPct) : _defaultFcp(sh));
      return rev > 0 ? rev * fcp / 100 : _n(frm?.budgetBelanja);
    };
    const totBudget  = _fcpRev(formS1,'S1') + _fcpRev(formS2,'S2') +
                       _fcpRev(formSNK1,'SNK1') + _fcpRev(formSNK2,'SNK2') + _fcpRev(formSNK3,'SNK3') + _fcpRev(formSNK4,'SNK4');
    // Sum aktTotal SAJA (tanpa fallback ke estTotal)
    const _aktOf = f => (f?.items||[]).reduce((s,it) => {
      return s + ((it.aktTotal !== null && it.aktTotal !== undefined && it.aktTotal !== '') ? _n(it.aktTotal) : 0);
    }, 0);
    const totAktOnly = _aktOf(formS1) + _aktOf(formS2) +
                       _aktOf(formSNK1) + _aktOf(formSNK2) + _aktOf(formSNK3) + _aktOf(formSNK4);
    const totSelisih = totBudget - totAktOnly;        // positive = surplus (sisa budget)
    const totPct     = totBudget > 0 ? totAktOnly / totBudget * 100 : 0;
    // Sisa AKT per shift = budget shift - aktTotal shift
    const shiftSisaAkt = budgetVal - totalAkt;
    const hasDayData = (formS1 || formS2 || formSNK1 || formSNK2 || formSNK3 || formSNK4) && totBudget > 0;

    // ── Mini date cards ──
    const days     = _daysInMonth(_formMonth);
    const firstDow = new Date(`${_formMonth}-01T00:00:00`).getDay();
    const cards    = Array.from({length:days},(_,i) => {
      const d       = i + 1;
      const dateStr = `${_formMonth}-${String(d).padStart(2,'0')}`;
      const hasS1   = _forms.some(f => f.tanggal === dateStr && f.shift === 'S1');
      const hasS2   = _forms.some(f => f.tanggal === dateStr && f.shift === 'S2');
      const hasSnk  = _forms.some(f => f.tanggal === dateStr && _isSnack(f.shift));
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
        ${hasSnk && !today?`<span style="position:absolute;bottom:2px;right:2px;
          width:5px;height:5px;border-radius:50%;background:#ec4899;display:block"></span>`:''}
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
          <div style="margin-left:6px;display:flex;gap:8px;font-size:10px;color:var(--text-3);flex-wrap:wrap">
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#6366f1;margin-right:3px;vertical-align:middle"></span>S1+S2</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f59e0b;margin-right:3px;vertical-align:middle"></span>S1</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f97316;margin-right:3px;vertical-align:middle"></span>S2</span>
            <span><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#ec4899;margin-right:3px;vertical-align:middle"></span>Snack</span>
            <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#ea580c;margin-right:3px;vertical-align:middle"></span>Event</span>
          </div>
          <button onclick="DailyOrderModule.addEvent()" title="Tambah Event Catering"
            style="margin-left:auto;padding:4px 10px;border:1px solid rgba(234,88,12,.4);border-radius:6px;
            background:rgba(234,88,12,.08);color:#ea580c;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;
            display:flex;align-items:center;gap:4px"
            onmouseover="this.style.background='#ea580c';this.style.color='#fff'"
            onmouseout="this.style.background='rgba(234,88,12,.08)';this.style.color='#ea580c'">+ Event</button>
        </div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;align-items:flex-end">
          ${cards}
          ${_getEventCards()}
        </div>
      </div>

      <!-- Shift + meta -->
      <div style="display:flex;gap:var(--s3);align-items:flex-end;flex-wrap:wrap;margin-bottom:var(--s4)">
        <div>
          <label style="font-size:11px;color:var(--text-3);font-weight:600;display:block;margin-bottom:4px">SHIFT</label>
          <div style="display:flex;gap:3px;flex-wrap:wrap">
            ${(() => {
              // If no snack orders exist for today, show all snack tabs (fresh day)
              const hasAnySnackOrder = _orders.some(o => o.tglOrder === _date &&
                (_n(o.snack1) > 0 || _n(o.snack2) > 0 || _n(o.snack3) > 0 || _n(o.snackBerat) > 0));
              const _tabVisible = (sh) => {
                if (_shift === sh) return true;
                if (!_isSnack(sh)) return true; // S1, S2 always visible
                if (_forms.some(f => f.tanggal === _date && f.shift === sh)) return true;
                if (_getOrderSummary(_date, sh).length > 0) return true;
                return !hasAnySnackOrder; // show all snack tabs when no snack orders yet
              };
              let sepInserted = false;
              return [
                {id:'S1',   label:'Shift 1',       snack:false},
                {id:'S2',   label:'Shift 2&amp;3', snack:false},
                {id:'SNK1', label:'🍘 S1',          snack:true},
                {id:'SNK2', label:'🍘 S2',          snack:true},
                {id:'SNK3', label:'🍘 S3',          snack:true},
                {id:'SNK4', label:'🍖 Berat',       snack:true},
              ].map((s) => {
                if (!_tabVisible(s.id)) return '';
                const sep = (s.snack && !sepInserted) ? (sepInserted = true,
                  '<div style="width:1px;background:var(--border);margin:0 2px;border-radius:1px"></div>') : '';
                return sep + `
                  <button onclick="DailyOrderModule.setShift('${s.id}')"
                    style="padding:6px 10px;border:1px solid ${_shift===s.id?(s.snack?'#ec4899':'var(--primary)'):'var(--border)'};border-radius:7px;
                      background:${_shift===s.id?(s.snack?'rgba(236,72,153,.1)':'rgba(99,102,241,.1)'):'var(--surface)'};
                      color:${_shift===s.id?(s.snack?'#ec4899':'var(--primary)'):'var(--text-2)'};
                      font-weight:${_shift===s.id?'700':'500'};font-size:11px;cursor:pointer;white-space:nowrap">
                    ${s.label}
                  </button>`;
              }).join('');
            })()}
          </div>
        </div>
        ${form ? `
          <div>
            <label style="font-size:11px;color:var(--text-3);font-weight:600;display:block;margin-bottom:4px">FOOD COST (%)</label>
            <input type="number" min="0" max="100" step="0.5" placeholder="${_defaultFcp(_shift)}"
              value="${(form.foodCostPct != null && !(form.foodCostPct === _DEFAULT_FCP && _isSnack(_shift))) ? form.foodCostPct : _defaultFcp(_shift)}"
              onblur="DailyOrderModule.updateFormMeta('foodCostPct', +this.value)"
              style="padding:8px 10px;border:1px solid var(--primary);border-radius:8px;background:rgba(99,102,241,.06);color:var(--primary);font-size:13px;width:80px;text-align:right;font-weight:700">
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
              <div style="font-size:12px;font-weight:700;color:var(--text)">${_fmtRp(totAktOnly)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:8px;color:var(--text-3);margin-bottom:1px">SELISIH</div>
              <div style="font-size:14px;font-weight:700;color:${_bc}">${totSelisih>=0?'+':'-'}${_fmtRp(Math.abs(totSelisih))}</div>
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

        ${budgetVal > 0 ? (() => {
          const _sbc = shiftSisaAkt>=0 ? '#10b981' : '#ef4444';
          const _sbl = shiftSisaAkt>=0 ? '▲ Surplus' : '▼ Defisit';
          const _spct = budgetVal > 0 ? totalAkt / budgetVal * 100 : 0;
          return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;min-width:220px">
          <div style="font-size:9px;font-weight:700;color:var(--primary);letter-spacing:.05em;margin-bottom:5px">BUDGET ${_shiftLabel(_shift).toUpperCase()}</div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:5px">
            <div>
              <div style="font-size:8px;color:var(--text-3);margin-bottom:1px">TERPAKAI</div>
              <div style="font-size:12px;font-weight:700;color:var(--text)">${_fmtRp(totalAkt)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:8px;color:var(--text-3);margin-bottom:1px">SISA</div>
              <div style="font-size:14px;font-weight:700;color:${_sbc}">${shiftSisaAkt>=0?'+':'-'}${_fmtRp(Math.abs(shiftSisaAkt))}</div>
            </div>
          </div>
          <div style="position:relative;background:var(--surface2);height:18px;border-radius:4px;overflow:hidden">
            <div style="position:absolute;inset:0 auto 0 0;width:${Math.min(100,_spct).toFixed(1)}%;background:${_sbc};border-radius:4px;transition:width .3s"></div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 7px;pointer-events:none">
              <span style="font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45)">${_sbl}</span>
              <span style="font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45)">${_spct.toFixed(1)}%</span>
            </div>
          </div>
        </div>`;
        })() : ''}
      </div>

      ${_isEvent(_shift) ? _htmlEventForm() : ''}
      ${!_isEvent(_shift) ? `
      <!-- Ringkasan orderan -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:var(--s4);margin-bottom:var(--s4)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:.05em">
              RINGKASAN ORDER — ${_fmtDate(_date)} / ${_shiftLabel(_shift)}
            </div>
            ${form ? `<span style="font-size:10px;padding:3px 9px;border-radius:20px;font-weight:700;
              background:${form.status==='final'?'rgba(16,185,129,.12)':'rgba(245,158,11,.12)'};
              color:${form.status==='final'?'#10b981':'#f59e0b'}">
              ${form.status==='final'?'✓ Final':'● Draft'}
            </span>` : ''}
          </div>
          ${revenue > 0 && totalPortions > 0 ? (() => {
            const _sisaEst = budgetVal - totalEst;
            const _sisaAkt = shiftSisaAkt;
            const _badge = (label, v) => `<span style="background:${v>=0?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)'};color:${v>=0?'#059669':'#ef4444'};padding:2px 8px;border-radius:12px;font-weight:700;font-size:10px;white-space:nowrap">${label} ${v>=0?'+':'-'}${_fmtRp(Math.abs(v))}</span>`;
            return `
            <div style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="background:${budgetOk?'rgba(16,185,129,.18)':'rgba(239,68,68,.18)'};
                color:${budgetOk?'#10b981':'#ef4444'};padding:3px 10px;border-radius:20px;font-weight:700;font-size:12px">
                Budget ${_fmtRp(budgetVal)}
              </span>
              <span style="background:rgba(99,102,241,.15);color:#6366f1;padding:3px 10px;border-radius:20px;font-weight:700;font-size:11px">Est HPP ${_fmtRp(totalEst)}</span>
              ${_badge('Sisa Est', _sisaEst)}
              ${_badge('Sisa Akt', _sisaAkt)}
            </div>`;
          })() : ''}
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
                  <div style="font-size:9px;color:var(--text-3);font-weight:600;white-space:nowrap" title="${c.nama}">${_shortName(c.nama)}</div>
                  <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.3">${c.total.toLocaleString('id-ID')}</div>
                  <div style="font-size:9px;color:var(--text-3)">${sub}</div>
                </div>`;
              }).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px">
              <span style="background:${_isSnack(_shift)?'rgba(236,72,153,.15)':'rgba(99,102,241,.15)'};
                color:${_isSnack(_shift)?'#ec4899':'var(--primary)'};
                padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px;white-space:nowrap">
                Total: ${totalPortions.toLocaleString('id-ID')} ${_isSnack(_shift)?'snack':'pax'}
              </span>
              ${!_isSnack(_shift) && totalPortions > 0 ? `
              <span style="font-size:11px;color:var(--text-2)">Lauk: <strong style="color:var(--text)">${totalLauk.toLocaleString('id-ID')} pcs</strong></span>
              <span style="font-size:11px;color:var(--text-2)">Pendamping: <strong style="color:var(--text)">${totalPendamping.toLocaleString('id-ID')} pcs</strong></span>
              ` : ''}
            </div>`
        }
      </div>
      ` : ''}

      <!-- Form produksi table -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:var(--s3) var(--s4);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;
          background:${_isSnack(_shift)?'rgba(236,72,153,.1)':'rgba(99,102,241,.1)'};
          border-bottom-color:${_isSnack(_shift)?'rgba(236,72,153,.25)':'rgba(99,102,241,.25)'}">
          <div>
            <span style="font-size:13px;font-weight:700;color:${_isSnack(_shift)?'#9d174d':'#3730a3'}">Form Produksi</span>
            <span style="font-size:11px;color:${_isSnack(_shift)?'rgba(157,23,77,.6)':'rgba(55,48,163,.6)'};margin-left:8px">${items.length} bahan</span>
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
              <button onclick="DailyOrderModule.openCopyFormModal()"
                style="padding:6px 12px;border:1px solid rgba(139,92,246,.4);border-radius:7px;background:rgba(139,92,246,.08);color:#8b5cf6;font-size:12px;cursor:pointer;font-weight:600">Copy Form</button>
              <button onclick="DailyOrderModule.printForm()"
                style="padding:6px 12px;border:1px solid rgba(99,102,241,.4);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;cursor:pointer;font-weight:600">Print</button>
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
              <table id="do-grid" data-grid-select style="width:100%;border-collapse:collapse;font-size:11px;min-width:700px">
                <thead>
                  <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
                    <th style="padding:7px 5px;text-align:center;color:var(--text-3);font-weight:600;width:30px">#</th>
                    <th style="padding:7px 5px;text-align:left;color:var(--text-3);font-weight:600;min-width:140px">ITEM / BAHAN</th>
                    <th style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:600">EST QTY</th>
                    <th style="padding:7px 5px;text-align:center;color:var(--text-3);font-weight:600">SAT</th>
                    <th style="padding:7px 5px;text-align:right;color:var(--text-3);font-weight:600;white-space:nowrap">HARGA @</th>
                    <th style="padding:7px 5px;text-align:right;color:#6366f1;font-weight:600;white-space:nowrap">EST TOTAL</th>
                    <th style="padding:7px 5px;text-align:right;color:#10b981;font-weight:600;white-space:nowrap">AKT QTY
                      ${items.length > 0 && (Auth.currentUser()?.role === 'superadmin' || Auth.currentUser()?.role === 'admin')
                        ? `<button onclick="DailyOrderModule.copyEstToAkt()" title="Copy semua Est QTY ke Akt QTY (Admin only)"
                        style="margin-left:3px;padding:1px 5px;border:1px solid rgba(16,185,129,.4);border-radius:4px;background:rgba(16,185,129,.1);
                          color:#10b981;font-size:8px;font-weight:700;cursor:pointer;vertical-align:middle"
                        onmouseover="this.style.background='#10b981';this.style.color='#fff'"
                        onmouseout="this.style.background='rgba(16,185,129,.1)';this.style.color='#10b981'">COPY EST</button>` : ''}
                    </th>
                    <th style="padding:7px 5px;text-align:right;color:#10b981;font-weight:600;white-space:nowrap">AKT TOTAL</th>
                    <th style="padding:7px 5px;text-align:center;color:var(--text-3);font-weight:600">SUMBER</th>
                    <th style="padding:7px 5px;text-align:left;color:var(--text-3);font-weight:600">CATATAN</th>
                    <th style="padding:7px 5px;width:50px"></th>
                    <th style="padding:4px 2px;text-align:center;width:20px"><input type="checkbox" title="Pilih semua" onchange="DailyOrderModule._bulkToggleAll(this.checked)" style="cursor:pointer"></th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length === 0 && _editingItemId !== 'new'
                    ? `<tr><td colspan="12" style="padding:28px;text-align:center;color:var(--text-3)">
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
                      <td colspan="6" style="padding:9px 5px;text-align:right;color:var(--text-3);font-size:10px;letter-spacing:.03em">TOTAL ESTIMASI</td>
                      <td style="padding:9px 5px;text-align:right;color:#6366f1">${_fmtRp(totalEst)}</td>
                      <td style="padding:9px 5px;text-align:right;color:var(--text-3);font-size:10px">AKTUAL</td>
                      <td style="padding:9px 5px;text-align:right;color:#10b981">${_fmtRp(totalAkt)}</td>
                      <td colspan="2"></td>
                      <td style="padding:9px 5px;text-align:right;white-space:nowrap">
                        <div style="font-size:9px;color:var(--text-3);font-weight:600">SISA AKT (${_shiftLabel(_shift)})</div>
                        <div style="font-size:12px;font-weight:800;color:${shiftSisaAkt>=0?'#10b981':'#ef4444'}">
                          ${shiftSisaAkt>=0?'+':'-'}${_fmtRp(Math.abs(shiftSisaAkt))}
                        </div>
                      </td>
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
                      <td style="padding:8px;text-align:right">${_fmtRp(it.totalValue)}</td>
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
          ${totalNilai>=0?'+':''}${_fmtRp(Math.abs(totalNilai))}
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
                        ${ok?'-':(r.nilaiSelisih>0?'+':'')+_fmtRp(Math.abs(r.nilaiSelisih))}
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
    const rp = n => (n !== null && n !== undefined) ? 'Rp'+Math.round(n).toLocaleString('id') : '-';
    const rp0 = n => 'Rp'+Math.round(n||0).toLocaleString('id'); // always show, even 0

    const monthOrds = _orders.filter(o => o.tglOrder && o.tglOrder.slice(0,7) === _summaryMonth);

    function _ordMeals(o)  { return _n(o.breakfast)+_n(o.shift1)+_n(o.spare1)+_n(o.ot1)+_n(o.shift2)+_n(o.spare2)+_n(o.ot2)+_n(o.shift3)+_n(o.spare3)+_n(o.ot3); }
    function _ordSnacks(o) { return _n(o.snack1)+_n(o.snack2)+_n(o.snack3)+_n(o.snackBerat); }

    const custVol = {};
    monthOrds.forEach(o => {
      const nm = _resolveName(o.namaPerusahaan);
      custVol[nm] = (custVol[nm]||0) + _ordMeals(o) + _ordSnacks(o);
    });
    const customers = Object.keys(custVol).sort((a,b) => custVol[b]-custVol[a]);

    // Pre-compute omset/budget/spent per hari (1 pass, bukan 180 scans)
    const SHIFTS = ['S1','S2','SNK1','SNK2','SNK3','SNK4'];
    // Index forms by tanggal+shift for O(1) lookup
    const _formIdx = {};
    _forms.forEach(f => { if(f.tanggal) _formIdx[f.tanggal+'_'+f.shift] = f; });
    // Pre-compute revenue per date (1 pass through orders)
    const _revCache = {};
    monthOrds.forEach(o => {
      const d = o.tglOrder;
      const resolved = _resolveName(o.namaPerusahaan);
      const c = _customers.find(x => (x.nama||'').toLowerCase() === (resolved||'').toLowerCase()) || {};
      // S1 revenue
      let g1 = _n(o.breakfast)*_n(c.hargaBreakfast||c.hargaShift1) + _n(o.shift1)*_n(c.hargaShift1) + _n(o.spare1)*_n(c.hargaSpare1) + _n(o.ot1)*_n(c.hargaOT1||c.hargaShift1);
      let q1 = _n(o.breakfast)+_n(o.shift1)+_n(o.spare1)+_n(o.ot1);
      const pph1 = c.pph23 ? Math.round(g1*0.02) : 0;
      const r1 = g1 - pph1 - _n(c.biayaBox)*q1 - _n(c.biayaLainnya)*q1;
      // S2 revenue
      let g2 = _n(o.shift2)*_n(c.hargaShift2) + _n(o.spare2)*_n(c.hargaSpare2) + _n(o.ot2)*_n(c.hargaOT2||c.hargaShift2) + _n(o.shift3)*_n(c.hargaShift3) + _n(o.spare3)*_n(c.hargaSpare3) + _n(o.ot3)*_n(c.hargaOT3||c.hargaShift3);
      let q2 = _n(o.shift2)+_n(o.spare2)+_n(o.ot2)+_n(o.shift3)+_n(o.spare3)+_n(o.ot3);
      const pph2 = c.pph23 ? Math.round(g2*0.02) : 0;
      const r2 = g2 - pph2 - _n(c.biayaBox)*q2 - _n(c.biayaLainnya)*q2;
      // Snacks — hanya PPH23, TANPA biaya box & lainnya
      const _snkNet = (gross) => {
        const p = c.pph23 ? Math.round(gross*0.02) : 0;
        return gross - p;
      };
      const sn1g = _n(o.snack1)*_n(c.hargaSnack1), sn1q = _n(o.snack1);
      const sn2g = _n(o.snack2)*_n(c.hargaSnack2), sn2q = _n(o.snack2);
      const sn3g = _n(o.snack3)*_n(c.hargaSnack3), sn3q = _n(o.snack3);
      const sn4g = _n(o.snackBerat)*_n(c.hargaSnackBerat), sn4q = _n(o.snackBerat);
      if(!_revCache[d]) _revCache[d] = {S1:0,S2:0,SNK1:0,SNK2:0,SNK3:0,SNK4:0};
      _revCache[d].S1 += r1; _revCache[d].S2 += r2;
      _revCache[d].SNK1 += _snkNet(sn1g); _revCache[d].SNK2 += _snkNet(sn2g);
      _revCache[d].SNK3 += _snkNet(sn3g); _revCache[d].SNK4 += _snkNet(sn4g);
    });
    function _dayOmset(dateStr) {
      const r = _revCache[dateStr]; if(!r) return 0;
      return SHIFTS.reduce((s,sh) => s + (r[sh]||0), 0);
    }
    function _dayBudget(dateStr) {
      const r = _revCache[dateStr]; if(!r) return 0;
      return SHIFTS.reduce((s,sh) => {
        const frm = _formIdx[dateStr+'_'+sh];
        const rev = r[sh]||0;
        const fcp = (frm?.foodCostPct != null ? _n(frm.foodCostPct) : _defaultFcp(sh));
        return s + (rev > 0 ? rev * fcp / 100 : _n(frm?.budgetBelanja));
      }, 0);
    }
    function _daySpent(dateStr) {
      return SHIFTS.reduce((s,sh) => {
        const frm = _formIdx[dateStr+'_'+sh];
        return s + (frm?.items||[]).reduce((a,it) => {
          return a + ((it.aktTotal !== null && it.aktTotal !== undefined && it.aktTotal !== '') ? _n(it.aktTotal) : _n(it.estTotal));
        }, 0);
      }, 0);
    }
    // Actual spending HANYA dari shift yang aktualnya sudah lengkap
    function _dayActualSpent(dateStr) {
      let total = 0, allComplete = true, hasAnyForm = false;
      SHIFTS.forEach(sh => {
        const frm = _formIdx[dateStr+'_'+sh];
        if (!frm || !(frm.items||[]).length) return;
        hasAnyForm = true;
        const items = frm.items || [];
        const shiftComplete = items.every(it => it.aktTotal !== null && it.aktTotal !== undefined && it.aktTotal !== '');
        if (!shiftComplete) allComplete = false;
        total += items.reduce((a,it) => {
          return a + ((it.aktTotal !== null && it.aktTotal !== undefined && it.aktTotal !== '') ? _n(it.aktTotal) : 0);
        }, 0);
      });
      return { spent: total, complete: hasAnyForm && allComplete, hasForm: hasAnyForm };
    }

    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${_summaryMonth}-${String(d).padStart(2,'0')}`;
      const dayOrds = monthOrds.filter(o => o.tglOrder === dateStr);
      const cells = {};
      let totMeals = 0, totSnacks = 0;
      dayOrds.forEach(o => {
        const m = _ordMeals(o), s = _ordSnacks(o);
        const nm = _resolveName(o.namaPerusahaan);
        cells[nm] = (cells[nm]||0) + m + s;
        totMeals += m; totSnacks += s;
      });
      const omset  = dayOrds.length ? _dayOmset(dateStr) : 0;
      const budget = dayOrds.length ? _dayBudget(dateStr) : 0;
      const spent  = dayOrds.length ? _daySpent(dateStr) : 0;
      const actual = _dayActualSpent(dateStr);
      rows.push({dateStr, d, cells, totMeals, totSnacks, hasData: dayOrds.length > 0, omset, budget, spent,
        aktSpent: actual.spent, aktComplete: actual.complete, hasForm: actual.hasForm});
    }

    const custTotals = {};
    let grandMeals = 0, grandSnacks = 0, grandOmset = 0, grandBudget = 0, grandSpent = 0;
    rows.forEach(r => {
      customers.forEach(c => { custTotals[c] = (custTotals[c]||0) + (r.cells[c]||0); });
      grandMeals  += r.totMeals;
      grandSnacks += r.totSnacks;
      grandOmset  += r.omset;
      grandBudget += r.budget;
      grandSpent  += r.spent;
    });
    const activeDays = rows.filter(r => r.hasData).length;
    const grandSelisih = grandBudget - grandSpent;

    // Stats cards
    const statsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:10px;margin-bottom:16px">
        ${[
          {l:'Hari Aktif',     v:activeDays,                                      u:'hari',  c:'#6366f1', ic:'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4'},
          {l:'Total Porsi',    v:(grandMeals+grandSnacks).toLocaleString('id-ID'),u:'porsi', c:'#10b981', ic:'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'},
          {l:'Total Omset',    v:rp(grandOmset),                                  u:'',      c:'#8b5cf6', ic:'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'},
          {l:'Budget (FC)',    v:rp(grandBudget),                                  u:'',      c:'#f59e0b', ic:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'},
          {l:'Realisasi',      v:rp(grandSpent),                                   u:'',      c:'#ec4899', ic:'M3 3h18v18H3zM3 9h18M9 21V9'},
          {l:'Selisih',        v:(grandSelisih>=0?'+':'')+rp(Math.abs(grandSelisih)),u:grandSelisih>=0?'Surplus':'Defisit', c:grandSelisih>=0?'#10b981':'#ef4444', ic:'M22 12h-4l-3 9L9 3l-3 9H2'},
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 16px;position:relative;overflow:hidden">
            <div style="position:absolute;top:0;left:0;width:3px;height:100%;background:${s.c}"></div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <svg viewBox="0 0 24 24" fill="none" stroke="${s.c}" stroke-width="2" width="13" height="13" style="opacity:.7"><path d="${s.ic}"/></svg>
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3)">${s.l}</span>
            </div>
            <div style="font-size:18px;font-weight:800;color:${s.c};font-family:var(--font-mono);line-height:1.2">${s.v}</div>
            ${s.u?`<div style="font-size:10px;color:var(--text-3);margin-top:1px">${s.u}</div>`:''}
          </div>
        `).join('')}
      </div>`;

    // Navigation bar — selalu tampil
    const navHtml = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
        <button onclick="DailyOrderModule.setMonth('${prevM}')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;transition:.15s">&#8249; Bulan Sebelumnya</button>
        <div style="text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--primary)">${monthLabel}</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">${activeDays} hari aktif &middot; ${customers.length} customer</div>
        </div>
        <button onclick="DailyOrderModule.setMonth('${nextM}')" style="padding:6px 16px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;transition:.15s">Bulan Berikutnya &#8250;</button>
      </div>`;

    if (customers.length === 0) return navHtml + statsHtml + `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:48px;text-align:center;color:var(--text-3)">
        <div style="font-size:14px;font-weight:600">Tidak ada order untuk bulan ini</div>
      </div>`;

    const cell = v => v
      ? `<td class="sm-td" style="text-align:right;font-weight:600">${v.toLocaleString('id-ID')}</td>`
      : `<td class="sm-td" style="text-align:center;color:var(--border2)">-</td>`;

    return navHtml + statsHtml + `
      <style>
        .sm-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
        .sm-tbl{width:100%;border-collapse:collapse;font-size:11px;min-width:900px}
        .sm-tbl thead th{padding:7px 6px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;background:var(--thead-bg);color:var(--thead-text)}
        .sm-tbl thead th:first-child{border-radius:0}
        .sm-td{padding:5px 6px;border-bottom:1px solid rgba(0,0,0,.05)}
        .sm-tbl tbody tr{transition:background .1s}
        .sm-tbl tbody tr:hover td{background:rgba(99,102,241,.06)!important}
        .sm-tbl tfoot td{padding:8px 6px;font-weight:700;border-top:2px solid var(--primary);background:rgba(99,102,241,.04)}
        .sm-grp{border-left:2px solid rgba(99,102,241,.2)}
        .sm-fin{font-family:var(--font-mono);font-size:10px}
      </style>
      <div class="sm-card">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:800;color:var(--text)">Daily Order Summary</div>
        </div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table class="sm-tbl">
            <thead>
              <tr>
                <th style="text-align:left;padding-left:10px;min-width:90px">Tanggal</th>
                ${customers.map(c => `<th style="text-align:right" title="${c}">${_shortName(c)}</th>`).join('')}
                <th class="sm-grp" style="text-align:right">Porsi</th>
                <th style="text-align:right">Omset</th>
                <th class="sm-grp" style="text-align:right">Budget</th>
                <th style="text-align:right">Realisasi</th>
                <th style="text-align:right;min-width:80px">Selisih</th>
                <th style="text-align:right;min-width:50px">FC%</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r,i) => {
                const isToday = r.dateStr === _today();
                const dow = new Date(r.dateStr+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short'});
                const isSun = new Date(r.dateStr+'T00:00:00').getDay() === 0;
                const sel = r.budget - r.spent;
                const selC = sel >= 0 ? '#10b981' : '#ef4444';
                // FC% = aktual spent / omset (hanya jika aktual lengkap)
                const fcPct = (r.aktComplete && r.omset > 0) ? (r.aktSpent / r.omset * 100) : 0;
                const showSel = r.hasData && r.aktSpent > 0;
                const bg = isToday ? 'background:rgba(99,102,241,.05);' : isSun ? 'background:rgba(239,68,68,.02);' : i%2 ? 'background:rgba(0,0,0,.015);' : '';
                return `
                <tr style="${bg}">
                  <td class="sm-td" style="padding-left:10px;white-space:nowrap;color:${isSun?'#ef4444':'var(--text)'}">
                    <strong style="color:${isToday?'var(--primary)':'inherit'}">${String(r.d).padStart(2,'0')}</strong>
                    <span style="color:var(--text-3);margin-left:3px;font-size:10px">${dow}</span>
                    ${isToday?'<span style="font-size:8px;background:rgba(99,102,241,.15);color:var(--primary);padding:1px 4px;border-radius:6px;margin-left:3px;font-weight:700">NOW</span>':''}
                  </td>
                  ${customers.map(c => cell(r.cells[c]||0)).join('')}
                  <td class="sm-td sm-grp" style="text-align:right;font-weight:700;color:${r.hasData?'#059669':'var(--border2)'}">
                    ${r.hasData?(r.totMeals+r.totSnacks).toLocaleString('id-ID'):'-'}
                  </td>
                  <td class="sm-td sm-fin" style="text-align:right;color:${r.hasData?'#7c3aed':'var(--border2)'}">
                    ${r.hasData?rp0(r.omset):'-'}
                  </td>
                  <td class="sm-td sm-grp sm-fin" style="text-align:right;color:${r.hasData?'#d97706':'var(--border2)'}">
                    ${r.hasData?rp0(r.budget):'-'}
                  </td>
                  <td class="sm-td sm-fin" style="text-align:right;color:${r.hasData?'#be185d':'var(--border2)'}">
                    ${r.hasData?rp0(r.spent):'-'}
                  </td>
                  <td class="sm-td sm-fin" style="text-align:right;font-weight:700;color:${showSel?selC:'var(--border2)'}">
                    ${showSel?(sel>=0?'+':'')+rp0(Math.abs(sel)):'-'}
                  </td>
                  <td class="sm-td sm-fin" style="text-align:right">
                    ${r.aktComplete && r.omset > 0
                      ? `<span style="color:${fcPct>60?'#ef4444':fcPct>50?'#d97706':'#059669'};font-weight:700">${fcPct.toFixed(1)}%</span>`
                      : r.hasForm && !r.aktComplete
                        ? '<span style="color:#f59e0b;font-size:9px" title="Ada shift yang belum lengkap aktualnya">~</span>'
                        : '<span style="color:var(--border2)">-</span>'}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td style="padding-left:10px;color:var(--text);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em">TOTAL</td>
                ${customers.map(c => `<td style="text-align:right;color:var(--primary);font-weight:800">${custTotals[c]?custTotals[c].toLocaleString('id-ID'):'-'}</td>`).join('')}
                <td class="sm-grp" style="text-align:right;color:#059669;font-weight:800">${(grandMeals+grandSnacks).toLocaleString('id-ID')}</td>
                <td class="sm-fin" style="text-align:right;color:#7c3aed">${rp0(grandOmset)}</td>
                <td class="sm-grp sm-fin" style="text-align:right;color:#d97706">${rp0(grandBudget)}</td>
                <td class="sm-fin" style="text-align:right;color:#be185d">${rp0(grandSpent)}</td>
                <td class="sm-fin" style="text-align:right;font-weight:800;color:${grandSelisih>=0?'#059669':'#ef4444'}">${grandSpent>0?(grandSelisih>=0?'+':'')+rp0(Math.abs(grandSelisih)):'-'}</td>
                <td class="sm-fin" style="text-align:right;color:var(--text);font-weight:700">${grandOmset>0?(grandSpent/grandOmset*100).toFixed(1)+'%':'-'}</td>
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
        <td data-field="di-harga" style="padding:7px 5px;text-align:right;color:var(--text-3)">${_n(it.hargaSatuan)?_fmtRp(it.hargaSatuan):'-'}</td>
        <td data-field="di-harga" style="padding:7px 5px;text-align:right;color:#6366f1">${_n(it.estTotal)?_fmtRp(it.estTotal):'-'}</td>
        <td data-field="di-aktqty" style="padding:7px 5px;text-align:right;color:#10b981;font-weight:600">${it.aktQty||'-'}${it._syncRevised?'<span style="font-size:7px;background:rgba(245,158,11,.15);color:#f59e0b;padding:0 3px;border-radius:3px;margin-left:2px;font-weight:700;vertical-align:middle">REV</span>':''}</td>
        <td data-field="di-aktqty" style="padding:7px 5px;text-align:right;color:#10b981">${_n(it.aktTotal)?_fmtRp(it.aktTotal):'-'}</td>
        <td data-field="di-aktqty" style="padding:7px 5px;text-align:center">
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;
            background:${sumber==='PASAR'?'rgba(239,68,68,.1)':sumber==='PARTIAL'?'rgba(245,158,11,.1)':'rgba(16,185,129,.1)'};
            color:${sumber==='PASAR'?'#ef4444':sumber==='PARTIAL'?'#f59e0b':'#10b981'}">${sumber}</span>
        </td>
        <td data-field="di-catatan" style="padding:7px 5px;color:var(--text-3);font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis">${it.catatan||''}</td>
        <td style="padding:7px 5px;text-align:center;white-space:nowrap">
          <button onclick="DailyOrderModule.startEditItem('${it.id}')" title="Edit"
            style="width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:11px">✎</button>
          <button onclick="DailyOrderModule.deleteItem('${it.id}')" title="Hapus"
            style="width:22px;height:22px;border-radius:4px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;font-size:11px;margin-left:2px">✕</button>
        </td>
        <td style="padding:4px 2px;text-align:center;width:20px" onclick="event.stopPropagation()">
          <input type="checkbox" class="do-bulk-chk" data-id="${it.id}" ${_bulkSelected.has(it.id)?'checked':''}
            onchange="DailyOrderModule._bulkToggle('${it.id}',this.checked)" style="cursor:pointer">
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
        <td style="padding:4px 3px;min-width:140px;position:relative">
          <input type="hidden" id="di-stok" value="${stok0}">
          <input id="di-item" class="form-control" style="${inp('min-width:120px')}"
            placeholder="Nama bahan..." value="${it?.item||''}" autocomplete="off"
            onchange="DailyOrderModule._autoFillFromInventory();DailyOrderModule._liveCompute()"
            oninput="DailyOrderModule._showItemSuggest()"
            onkeydown="DailyOrderModule._itemKeyDown(event)"
            onfocus="DailyOrderModule._showItemSuggest()"
            onblur="setTimeout(()=>DailyOrderModule._onItemBlur(),150)">
          <div id="di-item-drop" style="display:none"></div>
        </td>
        <td style="padding:4px 3px">
          <input id="di-estqty" class="form-control" style="${inp('text-align:right;width:60px')}"
            type="number" step="1" min="0" placeholder="0" value="${estQ0||''}"
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
            type="number" step="1" min="0" placeholder="0" value="${aktQ0||''}"
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
        <td style="width:20px"></td>
      </tr>`;
  }

  /* Live-compute EST TOTAL, AKT TOTAL, SUMBER while typing */
  function _liveCompute() {
    const estQty = parseFloat(document.getElementById('di-estqty')?.value||0)||0;
    const aktQty = parseFloat(document.getElementById('di-aktqty')?.value||0)||0;
    const stok   = parseFloat(document.getElementById('di-stok')?.value||0)||0;
    const harga  = parseFloat(document.getElementById('di-harga')?.value||0)||0;
    const sumber = _calcSumber(stok, aktQty);
    const sColor = sumber==='PASAR'?'#ef4444':sumber==='PARTIAL'?'#f59e0b':'#10b981';
    const $ = id => document.getElementById(id);
    if ($('di-esttot-d')) $('di-esttot-d').textContent = estQty&&harga ? (estQty*harga).toLocaleString('id-ID') : '-';
    if ($('di-akttot-d')) $('di-akttot-d').textContent = aktQty&&harga ? (aktQty*harga).toLocaleString('id-ID') : '-';
    if ($('di-sumb-d'))   {
      $('di-sumb-d').textContent  = sumber;
      $('di-sumb-d').style.background = sumber==='PASAR'?'rgba(239,68,68,.1)':sumber==='PARTIAL'?'rgba(245,158,11,.1)':'rgba(16,185,129,.1)';
      $('di-sumb-d').style.color = sColor;
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

  /* Item field: Arrow keys navigate suggest, Tab/Enter picks best match */
  function _itemKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); _hideSuggest(); _cancelEdit(); return; }
    const drop = document.getElementById('di-item-drop');
    const items = drop ? drop.querySelectorAll('.di-sug-item') : [];
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      _suggestIdx = Math.min(_suggestIdx + 1, items.length - 1);
      items.forEach((it, i) => it.style.background = i === _suggestIdx ? 'var(--surface2)' : '');
      items[_suggestIdx]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      _suggestIdx = Math.max(_suggestIdx - 1, 0);
      items.forEach((it, i) => it.style.background = i === _suggestIdx ? 'var(--surface2)' : '');
      items[_suggestIdx]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      const el = document.getElementById('di-item');
      if (!el) return;
      // If arrow-selected, pick that
      if (_suggestIdx >= 0 && items[_suggestIdx]) {
        el.value = items[_suggestIdx].dataset.v;
      } else {
        // Auto-pick best match from _suggestNames
        const val = el.value.trim();
        if (val) {
          const lv = val.toLowerCase();
          const rank = (n) => { const ln = n.toLowerCase(); if (ln === lv) return 0; if (ln.startsWith(lv)) return 1; if (ln.split(/[\s@(/)]+/).some(w => w.startsWith(lv))) return 2; if (ln.includes(lv)) return 3; return -1; };
          const best = _suggestNames.map(n => ({ n, r: rank(n) })).filter(x => x.r >= 0).sort((a,b) => a.r - b.r || a.n.length - b.n.length)[0];
          if (best) el.value = best.n;
        }
      }
      _hideSuggest();
      _autoFillFromInventory(); _liveCompute();
      document.getElementById('di-estqty')?.focus();
    }
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
    // Optimistic render: update UI immediately, save to DB in background
    _calcAllSumber();
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
    // Background save — no await, UI already updated
    DB.saveDailyOrderForm(form).then(savedForm => {
      if (savedForm && typeof savedForm === 'object') {
        const preserveKeys = new Set(['items']);
        Object.keys(savedForm).forEach(k => { if (!preserveKeys.has(k)) form[k] = savedForm[k]; });
      }
    }).catch(e => {
      console.error('[DO] saveRow:', e);
      Notify.error('Gagal menyimpan ke server — coba refresh');
      // Rollback local change if new item
      if (wasNew) { form.items.pop(); _renderContent(); }
    }).finally(() => { _saving = false; });
  }

  function _cancelEdit() {
    document.removeEventListener('click', _doOutsideClick);
    if (_editingItemId === 'new') {
      _editingItemId = null;
      _renderContent();
      Notify.info('Baris baru dibatalkan');
      return;
    }
    _editingItemId = null;
    _renderContent();
  }

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

  async function copyEstToAkt() {
    // Only admin & superadmin can use this — normal flow is via Sync revisi
    const role = Auth.currentUser()?.role;
    if (role !== 'superadmin' && role !== 'admin') {
      Notify.warning('Hanya Admin/Superadmin yang dapat Copy Est ke Akt. Gunakan Sync untuk revisi QTY.');
      return;
    }
    const form = _currentForm();
    if (!form || !form.items?.length) { Notify.warning('Tidak ada item untuk di-copy'); return; }
    if (form.status === 'final') { Notify.warning('Form sudah final, tidak bisa diubah'); return; }

    const ok = await Modal.confirm({
      title: 'Copy Est QTY → Akt QTY',
      message: `<div style="color:var(--text-2);font-size:13px">
        <p>Data <strong>Akt QTY</strong> seharusnya diisi melalui <strong>revisi saat Sync ke Inventory</strong>.</p>
        <p style="margin-top:8px">Fitur ini akan <strong>menimpa semua Akt QTY</strong> dengan nilai Est QTY tanpa proses revisi.</p>
        <p style="margin-top:8px;color:#f59e0b;font-weight:600">⚠ Lanjutkan hanya jika Anda yakin.</p>
      </div>`,
      confirmText: 'Ya, Copy Est → Akt',
    });
    if (!ok) return;

    let copied = 0;
    form.items.forEach(it => {
      const est = _n(it.estQty);
      if (est > 0) {
        it.aktQty = est;
        it.aktTotal = est * _n(it.hargaSatuan);
        it.sumber = _calcSumber(_n(it.stokGudang), est);
        copied++;
      }
    });
    if (!copied) { Notify.warning('Tidak ada Est QTY untuk di-copy'); return; }
    form.updatedAt = new Date().toISOString();
    try {
      await DB.saveDailyOrderForm(form);
      _calcAllSumber();
      _renderContent();
      Notify.success(`${copied} item: Est QTY → Akt QTY`);
    } catch(e) { Notify.error('Gagal menyimpan'); }
  }

  /* ── SYNC AKTUAL ke Inventory Activity Line ── */
  async function syncToInventory() {
    const form = _currentForm();
    if (!form || !form.items?.length) { Notify.warning('Tidak ada item untuk di-sync'); return; }

    // Hanya sync item yang punya aktQty > 0
    const toSync = form.items.filter(it => _n(it.aktQty) > 0);
    if (!toSync.length) { Notify.warning('Belum ada data aktual yang bisa di-sync'); return; }

    const shiftCode = _isEvent(_shift) ? 'EVENT' : {S1:'SHIFT 1',S2:'SHIFT 2',SNK1:'SHIFT 1',SNK2:'SHIFT 2',SNK3:'SHIFT 3',SNK4:'SHIFT 3'}[_shift] || _shift;
    const syncTag = 'do_' + _date.replace(/-/g,'') + '_' + _shift; // unique tag per form

    const ok = await Modal.confirm({
      title: 'Sync ke Inventory',
      message: `<p style="font-size:13px;margin-bottom:8px">Sync <strong>${toSync.length} item aktual</strong> dari form ini ke Activity Line Inventory?</p>
        <div style="font-size:11px;color:var(--text-3);background:var(--surface2);padding:8px 12px;border-radius:6px">
          Tanggal: <strong>${_date}</strong> &middot; Shift: <strong>${shiftCode}</strong><br>
          Jenis: <strong>KELUAR</strong> &middot; Tag: <code>${syncTag}</code><br><br>
          Item yang sudah di-sync sebelumnya akan di-<strong>update</strong> qty-nya, bukan duplikat.
        </div>`,
      confirmText: 'Sync',
    });
    if (!ok) return;

    // Load existing inventory logs to find previously synced entries
    let existingLogs = [];
    try { existingLogs = await DB.getInventory(); } catch(e) {
      try { existingLogs = JSON.parse(localStorage.getItem('becca_inv_activities')||'[]'); } catch {}
    }

    // Find inventory items for matching
    let invItems = [];
    try { invItems = await DB.getInventoryItems(); } catch(e) {
      try { invItems = JSON.parse(localStorage.getItem('becca_inv_products')||'[]'); } catch {}
    }

    let synced = 0, created = 0, updated = 0, skipped = 0;

    for (const it of toSync) {
      // Match item by name: exact first, then partial (contains)
      const itemLower = (it.item||'').toLowerCase();
      let invItem = invItems.find(i => (i.nama||'').toLowerCase() === itemLower);
      if (!invItem) invItem = invItems.find(i => (i.nama||'').toLowerCase().includes(itemLower) || itemLower.includes((i.nama||'').toLowerCase()));
      if (!invItem) { skipped++; console.warn('[Sync] Item tidak ditemukan di inventory:', it.item); continue; }

      // Check if already synced (same syncTag + itemId)
      const existing = existingLogs.find(l =>
        l.syncTag === syncTag && l.itemId === invItem.id
      );

      const logData = {
        id: existing?.id || undefined,
        tgl: _date,
        itemId: invItem.id,
        itemNama: invItem.nama,
        jenis: 'KELUAR',
        jumlah: _n(it.aktQty),
        harga: _n(it.hargaSatuan),
        kodeAktivitas: shiftCode,
        hpp: true,
        pengambil: 'Form Produksi',
        penanggungJawab: 'Auto Sync',
        catatan: 'Sync dari ' + _shiftLabel(_shift) + ' ' + _date,
        syncTag: syncTag,
      };

      try {
        await DB.saveInventoryLog(logData);
        if (existing) updated++; else created++;
        synced++;
      } catch(e) { console.warn('[Sync] error:', it.item, e); }
    }

    const msg = [];
    if (created) msg.push(created + ' baru');
    if (updated) msg.push(updated + ' diupdate');
    if (skipped) msg.push(skipped + ' dilewati (item tidak ada di stok)');
    Notify.success('Sync: ' + synced + ' item → Inventory' + (msg.length ? ' (' + msg.join(', ') + ')' : ''));
  }

  /* ── COPY FORM ke shift/tanggal lain ── */
  function openCopyFormModal() {
    const form = _currentForm();
    if (!form || !form.items?.length) { Notify.warning('Form kosong, tidak ada yang bisa di-copy'); return; }
    const srcLabel = `${new Date(_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})} / ${_isEvent(_shift)?_eventLabel(_shift):_shiftLabel(_shift)}`;
    const allShifts = [{id:'S1',l:'Shift 1'},{id:'S2',l:'Shift 2&3'},{id:'SNK1',l:'Snack S1'},{id:'SNK2',l:'Snack S2'},{id:'SNK3',l:'Snack S3'},{id:'SNK4',l:'Snack Berat'}];
    const shiftOpts = allShifts.map(s => `<option value="${s.id}">${s.l}</option>`).join('');
    // Juga list event yang ada
    const evtOpts = _forms.filter(f => _isEvent(f.shift)).map(f =>
      `<option value="${f.shift}">${_eventLabel(f.shift)} (${f.tanggal})</option>`).join('');

    const mid = 'cp-form-' + Utils.uid();
    window._cpFormMid = mid;
    Modal.open({
      id: mid,
      title: 'Copy Form Produksi',
      body: `
        <div style="margin-bottom:12px;font-size:12px;color:var(--text-3)">
          Copy <strong style="color:var(--text)">${form.items.length} item</strong> dari <strong style="color:var(--primary)">${srcLabel}</strong> ke:
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Tanggal Tujuan</label>
            <input type="date" class="form-control" id="cp-tgl" value="${_date}">
          </div>
          <div class="form-group">
            <label class="form-label">Shift Tujuan</label>
            <select class="form-control" id="cp-shift">
              ${shiftOpts}
              ${evtOpts}
            </select>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="cp-est-only" checked style="width:15px;height:15px;accent-color:#8b5cf6">
          <label for="cp-est-only" style="font-size:12px;color:var(--text-2);cursor:pointer">Hanya copy estimasi (tanpa data aktual)</label>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close(window._cpFormMid)">Batal</button>
        <button class="btn btn-primary" onclick="DailyOrderModule.doCopyForm()" style="background:#8b5cf6;border-color:#8b5cf6">Copy</button>`
    });
  }

  async function doCopyForm() {
    const form = _currentForm();
    if (!form || !form.items?.length) return;
    const tgl = document.getElementById('cp-tgl')?.value;
    const shift = document.getElementById('cp-shift')?.value;
    const estOnly = document.getElementById('cp-est-only')?.checked ?? true;
    if (!tgl || !shift) { Notify.warning('Pilih tanggal dan shift tujuan'); return; }
    if (tgl === _date && shift === _shift) { Notify.warning('Tidak bisa copy ke shift yang sama'); return; }

    // Cek apakah target sudah ada
    let target = _forms.find(f => f.tanggal === tgl && f.shift === shift);
    const isNew = !target;
    if (!target) {
      target = {
        id: 'do_' + tgl.replace(/-/g,'') + '_' + shift,
        tanggal: tgl, shift,
        budgetBelanja: 0, foodCostPct: _isEvent(shift) ? 45 : _defaultFcp(shift),
        items: [], status: 'draft',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
    }

    // Copy items
    const newItems = form.items.map(it => {
      const copy = {
        id: 'item_' + Utils.uid(),
        item: it.item, satuan: it.satuan, hargaSatuan: it.hargaSatuan,
        estQty: it.estQty, estTotal: it.estTotal,
        aktQty: estOnly ? 0 : (it.aktQty||0),
        aktTotal: estOnly ? 0 : (it.aktTotal||0),
        stokGudang: 0, sumber: 'STOK', catatan: '',
      };
      return copy;
    });

    target.items = newItems;
    target.updatedAt = new Date().toISOString();

    try {
      await DB.saveDailyOrderForm(target);
      if (isNew) _forms.push(target);
      Modal.close(window._cpFormMid);
      // Navigate to target
      _date = tgl; _shift = shift; _formMonth = tgl.slice(0,7);
      _renderFull(document.getElementById('page-daily-order'));
      Notify.success(`${newItems.length} item di-copy ke ${_shiftLabel(shift)} ${new Date(tgl+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}`);
    } catch(e) { Notify.error('Gagal copy form'); }
  }

  function printForm() {
    const form = _currentForm();
    if (!form || !form.items?.length) { Notify.warning('Tidak ada data untuk di-print'); return; }
    const items = form.items;
    const totalEst = items.reduce((s,it) => s + _n(it.estTotal), 0);
    const totalAkt = items.reduce((s,it) => s + _n(it.aktTotal), 0);
    const revenue  = _calcRevenue(_date, _shift);
    const fcp = (form.foodCostPct != null ? _n(form.foodCostPct) : _defaultFcp(_shift));
    const budgetVal = revenue > 0 ? revenue * fcp / 100 : _n(form.budgetBelanja);
    const dateLabel = new Date(_date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const rp = n => n ? 'Rp '+Math.round(n).toLocaleString('id') : '-';
    const summary = _getOrderSummary(_date, _shift);
    const totalPortions = summary.reduce((s,c) => s + c.total, 0);

    const custRows = summary.map(c => `
      <div style="display:inline-flex;align-items:center;gap:4px;background:#f0f0ff;border:1px solid #ddd;border-radius:6px;padding:4px 10px">
        <span style="font-size:10px;font-weight:700;color:#3B4E87">${_shortName(c.nama)}</span>
        <span style="font-size:12px;font-weight:800;color:#1a1a2e">${c.total}</span>
        <span style="font-size:9px;color:#999">${c.meals>0&&c.snacks>0?c.meals+'pax '+c.snacks+'snk':c.snacks>0?'snk':'pax'}</span>
      </div>`).join('');

    const itemRows = items.map((it,i) => {
      const sumber = it.sumber || _calcSumber(_n(it.stokGudang), _n(it.aktQty));
      return `<tr style="border-bottom:1px solid #ddd;${i%2?'background:#f8f9fa':''}">
        <td style="padding:4px 5px;text-align:center;color:#999;font-size:9px">${i+1}</td>
        <td style="padding:4px 5px;font-weight:600;font-size:10px">${it.item||''}</td>
        <td style="padding:4px 5px;text-align:right;color:#6366f1;font-weight:600">${it.estQty||'-'}</td>
        <td style="padding:4px 5px;text-align:center;color:#666">${it.satuan||''}</td>
        <td style="padding:4px 5px;text-align:right;color:#666">${_n(it.hargaSatuan)?rp(it.hargaSatuan):'-'}</td>
        <td style="padding:4px 5px;text-align:right;color:#6366f1">${_n(it.estTotal)?rp(it.estTotal):'-'}</td>
        <td style="padding:4px 5px;text-align:right;color:#10b981;font-weight:600">${it.aktQty||'-'}</td>
        <td style="padding:4px 5px;text-align:right;color:#10b981">${_n(it.aktTotal)?rp(it.aktTotal):'-'}</td>
        <td style="padding:4px 5px;text-align:center"><span style="font-size:9px;padding:1px 5px;border-radius:8px;
          background:${sumber==='PASAR'?'#fef2f2':'#f0fdf4'};color:${sumber==='PASAR'?'#ef4444':'#10b981'};font-weight:600">${sumber}</span></td>
      </tr>`;
    }).join('');

    const sisaEst = budgetVal - totalEst;
    const sisaAkt = budgetVal - totalAkt;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Form Produksi - ${dateLabel} - ${_shiftLabel(_shift)}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a2e;padding:16px}
      @page{size:A4 portrait;margin:8mm}
      @media print{.no-print{display:none!important}body{padding:0}}
      table{width:100%;border-collapse:collapse}
      th{background:#3B4E87;color:#fff;padding:5px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
      td{font-size:10px}
    </style></head><body>
    <button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 20px;background:#3B4E87;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;z-index:99">Print</button>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;border-bottom:3px solid #3B4E87;padding-bottom:8px">
      <div>
        <div style="font-size:16px;font-weight:900;color:#3B4E87">FORM PRODUKSI</div>
        <div style="font-size:10px;color:#666;margin-top:1px">BOGA PANGAN SENTOSA — Industrial Catering Service</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700">${dateLabel}</div>
        <div style="font-size:11px;color:#3B4E87;font-weight:700">${_shiftLabel(_shift)}</div>
        <div style="font-size:9px;color:#666;margin-top:1px">${form.status==='final'?'Final':'Draft'} &middot; FC ${fcp}%</div>
      </div>
    </div>

    <!-- Order Summary -->
    <div style="margin-bottom:10px;padding:8px 10px;background:#f8f8ff;border:1px solid #e0e0f0;border-radius:6px">
      <div style="font-size:8px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Ringkasan Order — ${totalPortions} porsi</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">${custRows}</div>
    </div>

    <!-- Budget Cards -->
    <div style="display:flex;gap:6px;margin-bottom:10px">
      ${[
        {l:'Budget',  v:rp(budgetVal), bg:'#f0f0ff', c:'#3B4E87'},
        {l:'Est HPP', v:rp(totalEst),  bg:'#f0f0ff', c:'#6366f1'},
        {l:'Akt HPP', v:rp(totalAkt),  bg:'#f0fff4', c:'#10b981'},
        {l:'Sisa Est',v:(sisaEst>=0?'+':'')+rp(Math.abs(sisaEst)), bg:sisaEst>=0?'#f0fff4':'#fff0f0', c:sisaEst>=0?'#10b981':'#ef4444'},
        {l:'Sisa Akt',v:(sisaAkt>=0?'+':'')+rp(Math.abs(sisaAkt)), bg:sisaAkt>=0?'#f0fff4':'#fff0f0', c:sisaAkt>=0?'#10b981':'#ef4444'},
      ].map(s=>`<div style="flex:1;background:${s.bg};border:1px solid #ddd;border-radius:5px;padding:5px 8px;min-width:0">
        <div style="font-size:7px;color:#666;font-weight:700;text-transform:uppercase">${s.l}</div>
        <div style="font-size:11px;font-weight:800;color:${s.c};white-space:nowrap">${s.v}</div>
      </div>`).join('')}
    </div>

    <!-- Items Table -->
    <table>
      <thead><tr>
        <th style="width:20px">#</th>
        <th style="text-align:left">Item / Bahan</th>
        <th style="text-align:right">Est Qty</th>
        <th style="text-align:center">Sat</th>
        <th style="text-align:right">Harga @</th>
        <th style="text-align:right">Est Total</th>
        <th style="text-align:right">Akt Qty</th>
        <th style="text-align:right">Akt Total</th>
        <th style="text-align:center">Sumber</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background:#e8eaf6;border-top:2px solid #3B4E87;font-weight:700">
          <td colspan="5" style="padding:5px;text-align:right;color:#666;font-size:9px">TOTAL</td>
          <td style="padding:5px;text-align:right;color:#6366f1">${rp(totalEst)}</td>
          <td></td>
          <td style="padding:5px;text-align:right;color:#10b981">${rp(totalAkt)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <!-- Signatures -->
    <div style="margin-top:20px;display:flex;justify-content:space-between">
      <div style="text-align:center;min-width:140px">
        <div style="font-size:9px;color:#666;margin-bottom:36px">Dibuat oleh,</div>
        <div style="border-top:1px solid #333;padding-top:2px;font-size:8px;color:#666">Admin Produksi</div>
      </div>
      <div style="text-align:center;min-width:140px">
        <div style="font-size:9px;color:#666;margin-bottom:36px">Disetujui oleh,</div>
        <div style="border-top:1px solid #333;padding-top:2px;font-size:8px;color:#666">Manager Produksi</div>
      </div>
    </div>
    </body></html>`;

    const w = window.open('','_blank','width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); }
    else Notify.warning('Popup diblokir browser');
  }

  /* ═══ EVENT CATERING ═══ */
  const _EVT_FC = 45; // default food cost event

  function _isEvent(shift) { return (shift||'').startsWith('EVT'); }

  function _getEventsForDate(date) {
    return _forms.filter(f => f.tanggal === date && _isEvent(f.shift)).sort((a,b) => (a.shift||'').localeCompare(b.shift||''));
  }

  function _nextEventShift(date) {
    const evts = _getEventsForDate(date);
    for (let i = 1; i <= 99; i++) {
      const s = 'EVT' + i;
      if (!evts.some(e => e.shift === s)) return s;
    }
    return 'EVT1';
  }

  function _eventLabel(shift) { return 'C' + (shift||'').replace('EVT',''); }

  function _getEventCards() {
    const evts = _forms.filter(f => f.tanggal && f.tanggal.slice(0,7) === _formMonth && _isEvent(f.shift));
    if (!evts.length) return '';
    // Group by date
    const byDate = {};
    evts.forEach(e => { if(!byDate[e.tanggal]) byDate[e.tanggal]=[]; byDate[e.tanggal].push(e); });
    return Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0])).map(([date, list]) => {
      return list.map(evt => {
        const sel = _date === date && _shift === evt.shift;
        const d = parseInt(date.slice(8));
        const label = _eventLabel(evt.shift);
        return `<button onclick="DailyOrderModule.setDate('${date}');DailyOrderModule.setShift('${evt.shift}')"
          title="${date} ${label}: ${evt.evtCustomer||'Event'}"
          style="width:${sel?33:28}px;height:${sel?44:36}px;flex-shrink:0;border-radius:6px;
          border:2px solid ${sel?'#374151':'transparent'};
          background:linear-gradient(135deg,#ea580c,#f97316);cursor:pointer;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:1px;padding:0;position:relative">
          <span style="font-size:7px;font-weight:700;color:rgba(255,255,255,.8);line-height:1">${label}</span>
          <span style="font-size:${sel?'12px':'10px'};font-weight:800;color:#fff;line-height:1">${d}</span>
        </button>`;
      }).join('');
    }).join('');
  }

  async function addEvent() {
    const date = _date;
    const shift = _nextEventShift(date);
    const form = {
      id: 'do_' + date.replace(/-/g,'') + '_' + shift,
      tanggal: date, shift,
      budgetBelanja: 0, foodCostPct: _EVT_FC,
      items: [], status: 'draft',
      evtCustomer: '', evtHarga: 0, evtPortions: 0, evtWaktu: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    try {
      await DB.saveDailyOrderForm(form);
      _forms.push(form);
      _shift = shift;
      _renderFull(document.getElementById('page-daily-order'));
      Notify.success('Event ' + _eventLabel(shift) + ' dibuat');
    } catch(e) { Notify.error('Gagal membuat event'); }
  }

  async function saveEventMeta(key, val) {
    const form = _currentForm();
    if (!form) return;
    if (key === 'evtHarga' || key === 'evtPortions' || key === 'foodCostPct') val = parseFloat(val) || 0;
    form[key] = val;
    form.updatedAt = new Date().toISOString();
    try { await DB.saveDailyOrderForm(form); } catch(e) {}
    // Recompute budget display
    if (key === 'evtHarga' || key === 'evtPortions' || key === 'foodCostPct') {
      const budEl = document.getElementById('evt-budget-display');
      if (budEl) {
        const h = form.evtHarga||0, p = form.evtPortions||0, fc = form.foodCostPct||_EVT_FC;
        budEl.textContent = _fmtRp(h * p * fc / 100);
      }
    }
  }

  function _htmlEventForm() {
    const form = _currentForm();
    if (!form) return '';
    const custs = _customers.map(c => c.nama).sort();
    const h = form.evtHarga||0, p = form.evtPortions||0, fc = form.foodCostPct||_EVT_FC;
    const budget = h * p * fc / 100;
    const totalEst = (form.items||[]).reduce((s,it) => s + _n(it.estTotal), 0);
    const totalAkt = (form.items||[]).reduce((s,it) => s + _n(it.aktTotal), 0);
    const sisa = budget - totalEst;

    return `
      <div style="background:linear-gradient(135deg,rgba(234,88,12,.06),rgba(249,115,22,.03));border:2px solid rgba(234,88,12,.25);border-radius:12px;padding:14px;margin-bottom:var(--s4)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:linear-gradient(135deg,#ea580c,#f97316);color:#fff;font-weight:800;font-size:13px;padding:4px 10px;border-radius:6px">${_eventLabel(_shift)}</span>
            <span style="font-size:12px;font-weight:700;color:#ea580c">EVENT CATERING</span>
            <span style="font-size:11px;color:var(--text-3)">${new Date(_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</span>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="DailyOrderModule.printForm()" style="padding:5px 10px;border:1px solid rgba(234,88,12,.3);border-radius:6px;background:transparent;color:#ea580c;font-size:11px;cursor:pointer;font-weight:600">Print</button>
            <button onclick="DailyOrderModule.deleteForm()" style="padding:5px 10px;border:1px solid rgba(239,68,68,.3);border-radius:6px;background:transparent;color:#ef4444;font-size:11px;cursor:pointer">Hapus</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">
          <div>
            <label style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Nama Perusahaan</label>
            <input list="evt-cust-list" value="${(form.evtCustomer||'').replace(/"/g,'&quot;')}" placeholder="Customer / Event"
              onchange="DailyOrderModule.saveEventMeta('evtCustomer',this.value)"
              style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;font-weight:600">
            <datalist id="evt-cust-list">${custs.map(n=>'<option value="'+n+'">').join('')}</datalist>
          </div>
          <div>
            <label style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Harga / Pax</label>
            <input type="number" min="0" value="${h}" onchange="DailyOrderModule.saveEventMeta('evtHarga',this.value)"
              style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;text-align:right;font-family:var(--font-mono)">
          </div>
          <div>
            <label style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Jumlah Porsi</label>
            <input type="number" min="0" value="${p}" onchange="DailyOrderModule.saveEventMeta('evtPortions',this.value)"
              style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;text-align:right;font-family:var(--font-mono)">
          </div>
          <div>
            <label style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">FC %</label>
            <input type="number" min="0" max="100" step="0.5" value="${fc}" onchange="DailyOrderModule.saveEventMeta('foodCostPct',this.value)"
              style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:#ea580c;font-size:12px;text-align:right;font-weight:700">
          </div>
          <div>
            <label style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Waktu Antar</label>
            <input type="time" value="${form.evtWaktu||''}" onchange="DailyOrderModule.saveEventMeta('evtWaktu',this.value)"
              style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px">
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span style="background:rgba(234,88,12,.15);color:#ea580c;padding:4px 12px;border-radius:20px;font-weight:700;font-size:12px" id="evt-budget-display">Budget ${_fmtRp(budget)}</span>
          <span style="background:rgba(99,102,241,.15);color:#6366f1;padding:3px 10px;border-radius:20px;font-weight:700;font-size:11px">Est HPP ${_fmtRp(totalEst)}</span>
          <span style="background:${sisa>=0?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)'};color:${sisa>=0?'#059669':'#ef4444'};padding:3px 10px;border-radius:20px;font-weight:700;font-size:11px">Sisa ${sisa>=0?'+':''}${_fmtRp(Math.abs(sisa))}</span>
        </div>
      </div>`;
  }

  async function createForm() {
    // Guard: don't create if already exists
    if (_currentForm()) { Notify.warning('Form sudah ada untuk tanggal dan shift ini'); return; }
    const form = {
      id          : 'do_' + _date.replace(/-/g,'') + '_' + _shift,
      tanggal     : _date,
      shift       : _shift,
      budgetBelanja: 0,
      foodCostPct  : _defaultFcp(_shift),
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

  let _suggestNames = [];
  let _suggestIdx = -1;

  function _initItemCombo() {
    _suggestNames = [...new Set(_inventory.map(i => i.nama).filter(Boolean))].sort();
  }

  function _showItemSuggest() {
    const el = document.getElementById('di-item');
    const drop = document.getElementById('di-item-drop');
    if (!el || !drop) return;
    const q = el.value.trim().toLowerCase();
    if (!q) { drop.style.display = 'none'; return; }
    // Rank: startsWith > word-startsWith > contains, shortest first
    const rank = (name) => {
      const ln = name.toLowerCase();
      if (ln.startsWith(q)) return 0;
      if (ln.split(/[\s@(/)]+/).some(w => w.startsWith(q))) return 1;
      if (ln.includes(q)) return 2;
      return -1;
    };
    const matches = _suggestNames.map(n => ({ n, r: rank(n) })).filter(x => x.r >= 0)
      .sort((a,b) => a.r - b.r || a.n.length - b.n.length).slice(0, 12);
    if (!matches.length) { drop.style.display = 'none'; return; }
    _suggestIdx = -1;
    drop.style.cssText = 'position:absolute;left:0;right:0;top:100%;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);max-height:200px;overflow-y:auto;display:block';
    drop.innerHTML = matches.map((m, i) => {
      const hl = m.n.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'), '<mark style="background:rgba(99,102,241,.25);border-radius:2px">$1</mark>');
      return `<div class="di-sug-item" data-i="${i}" data-v="${m.n.replace(/"/g,'&quot;')}"
        style="padding:6px 10px;cursor:pointer;font-size:11px;font-weight:500;color:var(--text);border-radius:6px;margin:2px"
        onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''"
        onmousedown="event.preventDefault();DailyOrderModule._pickSuggest(${i})"
        ontouchend="event.preventDefault();DailyOrderModule._pickSuggest(${i})">${hl}</div>`;
    }).join('');
  }

  function _pickSuggest(idx) {
    const drop = document.getElementById('di-item-drop');
    const el = document.getElementById('di-item');
    if (!drop || !el) return;
    const items = drop.querySelectorAll('.di-sug-item');
    if (items[idx]) { el.value = items[idx].dataset.v; }
    drop.style.display = 'none';
    _autoFillFromInventory(); _liveCompute();
    document.getElementById('di-estqty')?.focus();
  }

  /** Mobile: when item field loses focus (Next button), auto-pick best match */
  function _onItemBlur() {
    const el = document.getElementById('di-item');
    if (!el) return;
    const val = el.value.trim();
    if (!val) { _hideSuggest(); return; }
    // Check if already a valid inventory item
    const exact = _suggestNames.find(n => n.toLowerCase() === val.toLowerCase());
    if (exact) { el.value = exact; }
    else {
      // Auto-pick best partial match
      const lv = val.toLowerCase();
      const rank = (n) => { const ln = n.toLowerCase(); if (ln.startsWith(lv)) return 0; if (ln.includes(lv)) return 1; return -1; };
      const best = _suggestNames.map(n => ({ n, r: rank(n) })).filter(x => x.r >= 0).sort((a,b) => a.r - b.r || a.n.length - b.n.length)[0];
      if (best) el.value = best.n;
    }
    _hideSuggest();
    _autoFillFromInventory(); _liveCompute();
  }

  function _hideSuggest() {
    const drop = document.getElementById('di-item-drop');
    if (drop) drop.style.display = 'none';
    _suggestIdx = -1;
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
    setTimeout(() => {
      _initItemCombo();
      document.getElementById(focusField || 'di-item')?.focus();
      // Click outside to save & exit edit
      document.removeEventListener('click', _doOutsideClick);
      setTimeout(() => document.addEventListener('click', _doOutsideClick), 50);
    }, 60);
  }

  function _doOutsideClick(e) {
    if (!_editingItemId) return;
    // Ignore clicks on datalist, modals, notifications, buttons in header
    if (e.target.closest('.modal-overlay,.notify-popup,.page-header,.tabs,.becca-combo-drop,#di-item-drop')) return;
    const page = document.getElementById('page-daily-order');
    const grid = document.getElementById('do-grid');
    // Only trigger if click is outside the entire daily-order table area
    if (grid && !grid.contains(e.target)) {
      document.removeEventListener('click', _doOutsideClick);
      const item = document.getElementById('di-item')?.value?.trim();
      if (_editingItemId === 'new' && !item) { _cancelEdit(); return; }
      if (item) _saveEditRow();
      else _cancelEdit();
    }
  }

  /* ── Bulk Delete ── */
  function _bulkToggle(id, checked) {
    if (checked) _bulkSelected.add(id); else _bulkSelected.delete(id);
    _renderBulkBar();
  }
  function _bulkToggleAll(checked) {
    document.querySelectorAll('.do-bulk-chk').forEach(c => { if (checked) _bulkSelected.add(c.dataset.id); else _bulkSelected.delete(c.dataset.id); c.checked = checked; });
    _renderBulkBar();
  }
  function _renderBulkBar() {
    let bar = document.getElementById('do-bulk-bar');
    if (_bulkSelected.size === 0) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'do-bulk-bar';
      bar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:500;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:8px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);';
      document.body.appendChild(bar);
    }
    bar.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:var(--text)">${_bulkSelected.size} dipilih</span>
      <button onclick="DailyOrderModule._bulkDelete()" style="padding:6px 16px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:12px;font-weight:600;cursor:pointer">🗑 Hapus</button>
      <button onclick="DailyOrderModule._bulkClear()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;cursor:pointer">Batal</button>`;
  }
  function _bulkClear() {
    _bulkSelected.clear();
    document.querySelectorAll('.do-bulk-chk').forEach(c => c.checked = false);
    const hdr = document.querySelector('#do-grid thead input[type="checkbox"]');
    if (hdr) hdr.checked = false;
    _renderBulkBar();
  }
  async function _bulkDelete() {
    const form = _currentForm();
    if (!form) return;
    const count = _bulkSelected.size;
    const ok = await Modal.confirm({ title:'Hapus Bulk', message:`Hapus <strong>${count}</strong> bahan dari form ini?`, danger:true, confirmText:`Hapus ${count} Bahan` });
    if (!ok) return;
    const ids = [..._bulkSelected];
    form.items = (form.items||[]).filter(i => !ids.includes(i.id));
    form.updatedAt = new Date().toISOString();
    try {
      await DB.saveDailyOrderForm(form);
      _bulkSelected.clear();
      const bar = document.getElementById('do-bulk-bar'); if (bar) bar.remove();
      _renderContent();
      Notify.success(`${count} bahan dihapus`);
    } catch(e) { Notify.error('Gagal menghapus'); }
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
    createForm, addEvent, saveEventMeta, copyEstToAkt, syncToInventory, openCopyFormModal, doCopyForm, printForm, toggleStatus, deleteForm, updateFormMeta,
    startAddItem, startEditItem, deleteItem, _bulkToggle, _bulkToggleAll, _bulkDelete, _bulkClear, goToDate,
    _saveEditRow, _cancelEdit, _itemKeyDown, _showItemSuggest, _pickSuggest, _onItemBlur, _editKeyDown, _estQtyKeyDown, _aktQtyKeyDown,
    _liveCompute, _autoFillFromInventory,
  };
})();

window.DailyOrderModule = DailyOrderModule;
