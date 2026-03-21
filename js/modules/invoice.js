/* ============================================
   BECCA V2.0 — Invoice / AR Module
   Data: AR2026 Excel — 22 invoices, 4 tabs
   Tabs: Daftar AR | Summary | Overdue | Soon Due
============================================ */

const InvoiceModule = (() => {
  let _tab = 'ar';
  let _search = '';
  let _filterStatus = 'all';

  /* ─── DEFAULT DATA ─── */
  const _invoices = [{"id":"inv2026_01","no":1,"customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07101152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":"PAID","total":57124200,"tax2":1057855.556,"beforeTax":52892777,"pb1":5289277.778,"afterPph":51834922,"totalTerbayar":57122200,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":2000,"status":"Paid"},{"id":"inv2026_02","no":2,"customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06701152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":"PAID","total":39954600,"tax2":815400,"beforeTax":40770000,"pb1":0,"afterPph":39954600,"totalTerbayar":39954600,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_03","no":3,"customer":"PT. DDMI","po":"","invoiceNum":"06601152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":"PAID","total":18818940,"tax2":348498.889,"beforeTax":17424944,"pb1":1742494.444,"afterPph":17076445,"totalTerbayar":19357940,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_04","no":4,"customer":"PT. DDMI","po":"","invoiceNum":"06601152601E","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":"PAID","total":539000,"tax2":9981.481,"beforeTax":499074,"pb1":49907.407,"afterPph":489092,"totalTerbayar":0,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_05","no":5,"customer":"PT. Akashi Wahana Indonesia","po":"0196/PO/AWI/I/26","invoiceNum":"06401152601","tglInvoice":"2026-02-03","tglBayar":"2026-02-18","sisaHari":"PAID","total":108816452,"tax2":2220743.918,"beforeTax":111037195,"pb1":0,"afterPph":108816452,"totalTerbayar":106640123,"tglTerbayar":"2026-02-26","lamaTerbayar":"23 Hari","sisa":-44414,"status":"Paid"},{"id":"inv2026_06","no":6,"customer":"PT. Akashi Wahana Indonesia","po":"","invoiceNum":"064A14142601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":"PAID","total":500000,"tax2":10204.082,"beforeTax":510204,"pb1":0,"afterPph":500000,"totalTerbayar":500000,"tglTerbayar":"2026-01-23","lamaTerbayar":"4 Hari","sisa":-10204,"status":"Paid"},{"id":"inv2026_07","no":7,"customer":"SODEXO INDONESIA","po":"PO/G/26/01/20/2125","invoiceNum":"05101152601","tglInvoice":"2026-01-21","tglBayar":"2026-03-22","sisaHari":2,"total":124999600,"tax2":0,"beforeTax":113636000,"pb1":11363600,"afterPph":113636000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":122499608,"status":"Unpaid"},{"id":"inv2026_08","no":8,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03001152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":"PAID","total":61960500,"tax2":1264500,"beforeTax":63225000,"pb1":0,"afterPph":61960500,"totalTerbayar":61960500,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_09","no":9,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A01152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-18","sisaHari":"PAID","total":30552480,"tax2":623520,"beforeTax":31176000,"pb1":0,"afterPph":30552480,"totalTerbayar":40413240,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_10","no":10,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B01152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-18","sisaHari":"PAID","total":9860760,"tax2":201240,"beforeTax":10062000,"pb1":0,"afterPph":9860760,"totalTerbayar":0,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_11","no":11,"customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06716312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":"PAID","total":41601000,"tax2":849000,"beforeTax":42450000,"pb1":0,"afterPph":41601000,"totalTerbayar":41601000,"tglTerbayar":"2026-02-18","lamaTerbayar":"16 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_12","no":12,"customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07116312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":"PAID","total":68237400,"tax2":1263655.556,"beforeTax":63182777,"pb1":6318277.778,"afterPph":61919122,"totalTerbayar":68279500,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":-42100,"status":"Paid"},{"id":"inv2026_13","no":13,"customer":"PT. DDMI","po":"","invoiceNum":"06619312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":"PAID","total":34683306,"tax2":642283.444,"beforeTax":32114172,"pb1":3211417.222,"afterPph":31471888,"totalTerbayar":34683306,"tglTerbayar":"2026-02-27","lamaTerbayar":"25 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_14","no":14,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062A01312601","tglInvoice":"2026-02-05","tglBayar":"2026-02-20","sisaHari":"PAID","total":43448400,"tax2":804600,"beforeTax":40230000,"pb1":4023000,"afterPph":39425400,"totalTerbayar":129275000,"tglTerbayar":"2026-02-27","lamaTerbayar":"22 Hari","sisa":1000,"status":"Paid"},{"id":"inv2026_15","no":15,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062B01312601R","tglInvoice":"2026-02-05","tglBayar":"2026-02-20","sisaHari":"PAID","total":85827600,"tax2":1589400,"beforeTax":79470000,"pb1":7947000,"afterPph":77880600,"totalTerbayar":0,"tglTerbayar":"2026-02-27","lamaTerbayar":"22 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_16","no":16,"customer":"SODEXO INDONESIA","po":"PO/G/26/02/04/3804","invoiceNum":"05116312601","tglInvoice":"2026-02-06","tglBayar":"2026-04-07","sisaHari":18,"total":136705250,"tax2":0,"beforeTax":124277500,"pb1":12427750,"afterPph":124277500,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":133971145,"status":"Unpaid"},{"id":"inv2026_17","no":17,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03016312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":"PAID","total":69516300,"tax2":1418700,"beforeTax":70935000,"pb1":0,"afterPph":69516300,"totalTerbayar":69516300,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_18","no":18,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A16312601","tglInvoice":"2026-02-02","tglBayar":"2026-03-04","sisaHari":"PAID","total":34874280,"tax2":711720,"beforeTax":35586000,"pb1":0,"afterPph":34874280,"totalTerbayar":47892600,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_19","no":19,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B16312601","tglInvoice":"2026-02-02","tglBayar":"2026-03-04","sisaHari":"PAID","total":13018320,"tax2":265680,"beforeTax":13284000,"pb1":0,"afterPph":13018320,"totalTerbayar":0,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv2026_20","no":20,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01016312601R","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":8,"total":72330300,"tax2":1339450,"beforeTax":66972500,"pb1":6697250,"afterPph":65633050,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":72330300,"status":"Unpaid"},{"id":"inv2026_21","no":21,"customer":"PT. Akashi Wahana Indonesia","po":"","invoiceNum":"064A25252601","tglInvoice":"2026-02-03","tglBayar":"2026-02-18","sisaHari":"PAID","total":1488670,"tax2":30381.02,"beforeTax":1519051,"pb1":0,"afterPph":1488670,"totalTerbayar":1488670,"tglTerbayar":"2026-02-25","lamaTerbayar":"22 Hari","sisa":-30381,"status":"Paid"},{"id":"inv2026_22","no":22,"customer":"PT. SDM ( Outsource )","po":"","invoiceNum":"01016312601TR","tglInvoice":"2026-03-02","tglBayar":"2026-04-01","sisaHari":12,"total":11799200,"tax2":0,"beforeTax":10726545,"pb1":1072654.545,"afterPph":10726545,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":11799200,"status":"Unpaid"}];

  const _monthly = [{"no":1,"bulan":"JANUARI","omzetAfterPb1":1006513929,"omzetInvoice":1066656558,"totalInvoice":22,"totalClient":10,"overdue":0,"unpaid":341076080,"piutang":1066656558,"pb1":60142629,"pph23":15466813.95},{"no":2,"bulan":"FEBRUARI","omzetAfterPb1":890766581,"omzetInvoice":943190698,"totalInvoice":23,"totalClient":9,"overdue":116267400,"unpaid":524254504,"piutang":943190698,"pb1":52424116,"pph23":13551277.17},{"no":3,"bulan":"MARET","omzetAfterPb1":299920844,"omzetInvoice":320141878,"totalInvoice":9,"totalClient":8,"overdue":9054000,"unpaid":317483558,"piutang":320141878,"pb1":20221033,"pph23":3385486.63},{"no":4,"bulan":"APRIL","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":5,"bulan":"MEI","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":6,"bulan":"JUNI","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":7,"bulan":"JULI","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":8,"bulan":"AGUSTUS","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":9,"bulan":"SEPTEMBER","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":10,"bulan":"OKTOBER","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":11,"bulan":"NOVEMBER","omzetAfterPb1":0,"omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"piutang":0,"pb1":0,"pph23":0},{"no":12,"bulan":"DESEMBER","omzetAfterPb1":7350000,"omzetInvoice":7350000,"totalInvoice":1,"totalClient":1,"overdue":0,"unpaid":7350000,"piutang":7350000,"pb1":0,"pph23":150000}];

  const _overdue = [{"no":1,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","invoiceNum":"062A01282602R","tglInvoice":"2026-03-03","tglBayar":"2026-03-18","sisaHari":-2,"total":39625200,"sisa":39625200},{"no":2,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","invoiceNum":"062B01282602","tglInvoice":"2026-03-02","tglBayar":"2026-03-17","sisaHari":-3,"total":76642200,"sisa":76642200},{"no":3,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","invoiceNum":"01004042603","tglInvoice":"2026-03-05","tglBayar":"","sisaHari":-46101,"total":7938000,"sisa":7938000},{"no":4,"customer":"Event","invoiceNum":"09916162603","tglInvoice":"2026-03-16","tglBayar":"2026-03-16","sisaHari":-4,"total":1116000,"sisa":1116000}];

  const _soon = [{"no":1,"customer":"SODEXO INDONESIA","invoiceNum":"05101152601","tglInvoice":"2026-01-21","tglBayar":"2026-03-22","sisaHari":2,"total":124999600,"sisa":122499608},{"no":2,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","invoiceNum":"01016312601R","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":8,"total":72330300,"sisa":72330300},{"no":3,"customer":"PT. SDM ( Outsource )","invoiceNum":"01016312601TR","tglInvoice":"2026-03-02","tglBayar":"2026-04-01","sisaHari":12,"total":11799200,"sisa":11799200},{"no":4,"customer":"PT. Akashi Wahana Indonesia","invoiceNum":"06416282602R","tglInvoice":"2026-03-10","tglBayar":"2026-03-25","sisaHari":5,"total":106870658,"sisa":106870658},{"no":5,"customer":"PT. RESONAC MATERIALS INDONESIA","invoiceNum":"07101152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":12,"total":43149400,"sisa":43149400},{"no":6,"customer":"PT. NBC INDONESIA","invoiceNum":"06701152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":12,"total":14347200,"sisa":14347200},{"no":7,"customer":"PT. DDMI","invoiceNum":"06601152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":12,"total":23750478,"sisa":23750478},{"no":8,"customer":"PT. Shinto Kogyo Indonesia","invoiceNum":"030A07072612","tglInvoice":"2026-03-15","tglBayar":"2026-03-30","sisaHari":10,"total":7350000,"sisa":7350000},{"no":9,"customer":"PT. Shinto Kogyo Indonesia","invoiceNum":"03001152603","tglInvoice":"2026-03-15","tglBayar":"2026-03-30","sisaHari":10,"total":57188880,"sisa":57188880}];

  const _clients = [{"nama":"SODEXO INDONESIA","omzet":597583500},{"nama":"PT. Shinto Kogyo Indonesia","omzet":331215000},{"nama":"PT. RESONAC MATERIALS INDONESIA","omzet":258157407},{"nama":"PT. DAIKI ALMUNIUM INDUSTRI IND","omzet":227355000},{"nama":"PT. Akashi Wahana Indonesia","omzet":222118142},{"nama":"SUPER STEEL KARAWANG","omzet":197368000},{"nama":"PT. NBC INDONESIA","omzet":157410000},{"nama":"PT. NUGRAHA INDAH CITARASA INDONESIA","omzet":132566166},{"nama":"PT. DDMI","omzet":101489170},{"nama":"PT. SDM ( Outsource )","omzet":10726545},{"nama":"Event","omzet":1116000}];

  /* ─── HELPERS ─── */
  function _rp(v) {
    const n = Number(v)||0;
    if (n === 0) return '-';
    if (Math.abs(n) >= 1e9) return 'Rp' + (n/1e9).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e6) return 'Rp' + (n/1e6).toFixed(1) + 'jt';
    return 'Rp' + n.toLocaleString('id');
  }
  function _rpFull(v) {
    const n = Number(v)||0;
    return n ? 'Rp' + n.toLocaleString('id') : '-';
  }
  function _statusBadge(s, sisa) {
    if (s === 'Paid')    return `<span class="inv-badge paid">✓ Lunas</span>`;
    if (s === 'Overdue') return `<span class="inv-badge overdue">⚠ Overdue ${sisa} hr</span>`;
    const d = typeof sisa === 'number' ? sisa : 0;
    const col = d <= 3 ? 'urgent' : d <= 7 ? 'warn' : 'info';
    return `<span class="inv-badge ${col}">⏱ ${d} hari lagi</span>`;
  }
  function _fmtDate(s) {
    if (!s) return '-';
    const d = new Date(s);
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-invoice');
    if (!page) return;
    _renderFull(page);
  }

  /* ─── FULL RENDER ─── */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-invoice');
    if (!page) return;

    const paid    = _invoices.filter(i => i.status==='Paid').length;
    const unpaid  = _invoices.filter(i => i.status==='Unpaid').length;
    const overdue = _invoices.filter(i => i.status==='Overdue').length;

    page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Account Receivable (AR) 2026</h2>
        <p>Piutang & monitoring invoice catering — data per 20 Maret 2026</p>
      </div>
    </div>

    <style>
      /* ── STAT CARDS ── */
      .inv-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px }
      .inv-stat  { background:var(--surface); border:1px solid var(--border); border-radius:12px;
                   padding:14px 18px; position:relative; overflow:hidden }
      .inv-stat::before { content:''; position:absolute; top:0; left:0; width:4px; height:100%; background:var(--c) }
      .inv-stat-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-3) }
      .inv-stat-val   { font-size:20px; font-weight:900; color:var(--c); font-family:var(--font-mono); margin:4px 0 2px }
      .inv-stat-sub   { font-size:11px; color:var(--text-3) }

      /* ── TABS ── */
      .inv-tabs { display:flex; gap:2px; border-bottom:2px solid var(--border); margin-bottom:0 }
      .inv-tab  { padding:10px 18px; font-size:12px; font-weight:600; cursor:pointer; border:none;
                  background:transparent; color:var(--text-3); border-bottom:2px solid transparent;
                  margin-bottom:-2px; transition:.15s; border-radius:6px 6px 0 0 }
      .inv-tab:hover { color:var(--text); background:rgba(99,102,241,.06) }
      .inv-tab.active { color:#6366f1; border-bottom-color:#6366f1; background:rgba(99,102,241,.08) }
      .inv-tab .badge { display:inline-flex; align-items:center; justify-content:center;
                        background:currentColor; color:#fff; border-radius:10px;
                        font-size:9px; font-weight:700; padding:1px 6px; margin-left:6px; opacity:.8 }
      .inv-tab .badge span { color:#fff }

      /* ── BADGE STATUS ── */
      .inv-badge { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700;
                   padding:3px 8px; border-radius:20px; white-space:nowrap }
      .inv-badge.paid    { background:rgba(16,185,129,.12); color:#10b981; border:1px solid rgba(16,185,129,.3) }
      .inv-badge.overdue { background:rgba(239,68,68,.12);  color:#ef4444; border:1px solid rgba(239,68,68,.3) }
      .inv-badge.urgent  { background:rgba(239,68,68,.1);   color:#ef4444; border:1px solid rgba(239,68,68,.25) }
      .inv-badge.warn    { background:rgba(245,158,11,.12); color:#f59e0b; border:1px solid rgba(245,158,11,.3) }
      .inv-badge.info    { background:rgba(99,102,241,.1);  color:#6366f1; border:1px solid rgba(99,102,241,.25) }

      /* ── TABLE WRAPPER ── */
      .inv-card { background:var(--surface); border:1px solid var(--border); border-radius:0 0 12px 12px; overflow:hidden }
      .inv-toolbar { padding:10px 14px; border-bottom:1px solid var(--border);
                     display:flex; align-items:center; gap:10px; flex-wrap:wrap }
      .inv-scroll  { overflow-x:auto; -webkit-overflow-scrolling:touch }

      /* ── SUMMARY TABLE ── */
      .sum-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; padding:16px }
      .sum-section { background:var(--surface2); border:1px solid var(--border); border-radius:10px; overflow:hidden }
      .sum-section-title { padding:10px 14px; font-size:10px; font-weight:700; text-transform:uppercase;
                           letter-spacing:.08em; color:var(--text-3); border-bottom:1px solid var(--border) }
      .client-bar { padding:8px 14px; display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border) }
      .client-bar:last-child { border-bottom:none }
      .client-name { font-size:11px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
      .client-omzet { font-size:11px; font-family:var(--font-mono); color:var(--text-2); white-space:nowrap }
      .client-pct  { font-size:10px; color:var(--text-3); width:36px; text-align:right }
      .client-track { flex:1; max-width:80px; height:5px; background:var(--border); border-radius:3px; overflow:hidden }
      .client-fill  { height:100%; background:#6366f1; border-radius:3px }

      /* ── PROGRESS BAR (sisa hari) ── */
      .sisa-bar { width:60px; height:5px; background:var(--border); border-radius:3px; overflow:hidden; display:inline-block; vertical-align:middle; margin-left:4px }
    </style>

    <!-- STAT CARDS -->
    <div class="inv-stats">
      <div class="inv-stat" style="--c:#6366f1">
        <div class="inv-stat-label">Total Omzet 2026</div>
        <div class="inv-stat-val">Rp2,34M</div>
        <div class="inv-stat-sub">54 invoice terbit</div>
      </div>
      <div class="inv-stat" style="--c:#f59e0b">
        <div class="inv-stat-label">Outstanding</div>
        <div class="inv-stat-val">Rp1,24M</div>
        <div class="inv-stat-sub">belum terbayar</div>
      </div>
      <div class="inv-stat" style="--c:#ef4444">
        <div class="inv-stat-label">Overdue</div>
        <div class="inv-stat-val">Rp125,3jt</div>
        <div class="inv-stat-sub">${_overdue.length} invoice melewati jatuh tempo</div>
      </div>
      <div class="inv-stat" style="--c:#10b981">
        <div class="inv-stat-label">Soon Due (≤15 hari)</div>
        <div class="inv-stat-val">Rp461,8jt</div>
        <div class="inv-stat-sub">${_soon.length} invoice segera jatuh tempo</div>
      </div>
    </div>

    <!-- TABS -->
    <div class="inv-tabs">
      <button class="inv-tab ${_tab==='ar'?'active':''}" onclick="InvoiceModule.switchTab('ar')">
        📋 Daftar AR <div class="badge"><span>${_invoices.length}</span></div>
      </button>
      <button class="inv-tab ${_tab==='summary'?'active':''}" onclick="InvoiceModule.switchTab('summary')">
        📊 Summary Bulanan
      </button>
      <button class="inv-tab ${_tab==='overdue'?'active':''}" onclick="InvoiceModule.switchTab('overdue')">
        ⚠️ Overdue <div class="badge"><span>${_overdue.length}</span></div>
      </button>
      <button class="inv-tab ${_tab==='soon'?'active':''}" onclick="InvoiceModule.switchTab('soon')">
        🔔 Soon Due <div class="badge"><span>${_soon.length}</span></div>
      </button>
    </div>

    <div class="inv-card" id="inv-content">
      ${_renderTabContent()}
    </div>`;
  }

  /* ─── TAB CONTENT ─── */
  function _renderTabContent() {
    if (_tab === 'ar')      return _renderAR();
    if (_tab === 'summary') return _renderSummary();
    if (_tab === 'overdue') return _renderOverdue();
    if (_tab === 'soon')    return _renderSoon();
    return '';
  }

  /* ══ TAB: DAFTAR AR ══ */
  function _renderAR() {
    let list = _invoices;
    if (_search) list = list.filter(i =>
      i.customer.toLowerCase().includes(_search) ||
      i.invoiceNum.toLowerCase().includes(_search));
    if (_filterStatus !== 'all') list = list.filter(i => i.status === _filterStatus);

    const paid    = list.filter(i=>i.status==='Paid').length;
    const unpaid  = list.filter(i=>i.status==='Unpaid').length;
    const overdue = list.filter(i=>i.status==='Overdue').length;

    return `
    <div class="inv-toolbar">
      <div style="position:relative;flex:1;max-width:260px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"
          style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input id="inv-search" placeholder="Cari customer / invoice #..." value="${_search}"
          style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;
                 background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
          oninput="InvoiceModule.setSearch(this.value)">
      </div>
      <select onchange="InvoiceModule.setFilter(this.value)"
        style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);cursor:pointer">
        <option value="all" ${_filterStatus==='all'?'selected':''}>Semua Status</option>
        <option value="Paid" ${_filterStatus==='Paid'?'selected':''}>✓ Lunas</option>
        <option value="Unpaid" ${_filterStatus==='Unpaid'?'selected':''}>⏱ Belum Bayar</option>
        <option value="Overdue" ${_filterStatus==='Overdue'?'selected':''}>⚠ Overdue</option>
      </select>
      <span style="font-size:11px;color:var(--text-3);margin-left:auto">
        ${list.length} invoice &nbsp;|&nbsp;
        <span style="color:#10b981">✓ ${paid} lunas</span> &nbsp;·&nbsp;
        <span style="color:#f59e0b">⏱ ${unpaid} pending</span>
        ${overdue ? ` &nbsp;·&nbsp; <span style="color:#ef4444">⚠ ${overdue} overdue</span>` : ''}
      </span>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;min-width:1100px;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th style="padding:9px 8px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;width:36px">#</th>
            <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;min-width:180px">Customer</th>
            <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Invoice #</th>
            <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">PO #</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Tgl Invoice</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Jatuh Tempo</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Total Invoice</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Tax 2%</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Before Tax</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Terbayar</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Tgl Bayar</th>
            <th style="padding:9px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Sisa</th>
            <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap">Status</th>
          </tr>
        </thead>
        <tbody>
        ${!list.length ? `<tr><td colspan="13" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data invoice.</td></tr>` :
          list.map((inv, i) => {
            const bg0 = i%2===0 ? 'var(--surface)' : 'var(--surface2)';
            const bg  = inv.status==='Overdue' ? 'rgba(239,68,68,.04)' : bg0;
            const sisa = inv.sisaHari;
            return `<tr onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(99,102,241,.06)'})"
                       onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"
                       style="border-bottom:1px solid var(--border)">
              <td style="padding:8px;text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${inv.no}</td>
              <td style="padding:8px 12px;font-weight:600;font-size:11px;background:${bg}">${inv.customer}</td>
              <td style="padding:8px 10px;font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
              <td style="padding:8px 10px;font-size:10px;color:var(--text-3);background:${bg}">${inv.po||'-'}</td>
              <td style="padding:8px 10px;text-align:center;font-size:10px;color:var(--text-2);background:${bg};white-space:nowrap">${_fmtDate(inv.tglInvoice)}</td>
              <td style="padding:8px 10px;text-align:center;font-size:10px;background:${bg};white-space:nowrap">${_fmtDate(inv.tglBayar)}</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:600;background:${bg}">${_rp(inv.total)}</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-3);background:${bg}">${_rpFull(Math.round(inv.tax2))}</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-3);background:${bg}">${_rpFull(inv.beforeTax)}</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:11px;background:${bg};color:${inv.totalTerbayar?'#10b981':'var(--text-3)'}">${inv.totalTerbayar ? _rp(inv.totalTerbayar) : '-'}</td>
              <td style="padding:8px 10px;text-align:center;font-size:10px;color:var(--text-2);background:${bg};white-space:nowrap">${_fmtDate(inv.tglTerbayar)}${inv.lamaTerbayar?'<br><span style="font-size:9px;color:var(--text-3)">'+inv.lamaTerbayar+'</span>':''}</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:600;background:${bg};color:${inv.sisa>0?'#f59e0b':inv.sisa<0?'#ef4444':'var(--text-3)'}">${inv.sisa !== 0 ? _rpFull(inv.sisa) : '-'}</td>
              <td style="padding:8px 10px;text-align:center;background:${bg}">${_statusBadge(inv.status, sisa)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  /* ══ TAB: SUMMARY BULANAN ══ */
  function _renderSummary() {
    const totalOmzet = 2337339134;
    return `
    <div style="padding:16px">
      <!-- Monthly Table -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px">
        <div style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);border-bottom:1px solid var(--border)">
          📅 Summary Bulanan 2026
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:800px">
            <thead>
              <tr style="background:var(--primary-h)">
                <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;width:40px">#</th>
                <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff">Bulan</th>
                <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff">Omzet Invoice</th>
                <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff">Omzet after PB1</th>
                <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff">Inv Terbit</th>
                <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff">Client</th>
                <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;color:#ef4444">Overdue</th>
                <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#f59e0b">Unpaid</th>
                <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff">PB1</th>
              </tr>
            </thead>
            <tbody>
            ${_monthly.map((m, i) => {
              const bg = i%2===0 ? 'var(--surface)' : 'var(--surface2)';
              const active = m.omzetInvoice > 0;
              return `<tr style="border-bottom:1px solid var(--border);opacity:${active?1:.4}">
                <td style="padding:7px 10px;font-size:10px;color:var(--text-3);background:${bg}">${m.no}</td>
                <td style="padding:7px 10px;font-weight:600;background:${bg}">${m.bulan}</td>
                <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg};color:${active?'#6366f1':'var(--text-3)'}">${active?_rp(m.omzetInvoice):'-'}</td>
                <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${active?_rp(m.omzetAfterPb1):'-'}</td>
                <td style="padding:7px 10px;text-align:center;font-weight:600;background:${bg}">${active?m.totalInvoice:'-'}</td>
                <td style="padding:7px 10px;text-align:center;background:${bg}">${active?m.totalClient:'-'}</td>
                <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);background:${bg};color:${m.overdue>0?'#ef4444':'var(--text-3)'}">${m.overdue>0?_rp(m.overdue):'-'}</td>
                <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);background:${bg};color:${m.unpaid>0?'#f59e0b':'var(--text-3)'}">${m.unpaid>0?_rp(m.unpaid):'-'}</td>
                <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-3);background:${bg}">${m.pb1>0?_rp(m.pb1):'-'}</td>
              </tr>`;
            }).join('')}
            <tr style="background:rgba(99,102,241,.08);border-top:2px solid var(--border)">
              <td colspan="2" style="padding:8px 10px;font-weight:700;font-size:11px">TOTAL YTD</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:900;color:#6366f1">Rp2,34M</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--text-2)">Rp2,20M</td>
              <td style="padding:8px 10px;text-align:center;font-weight:700">54</td>
              <td style="padding:8px 10px;text-align:center;font-weight:700">11</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#ef4444">Rp125,3jt</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#f59e0b">Rp1,19M</td>
              <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700">Rp132,8jt</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Client Contribution -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);border-bottom:1px solid var(--border)">
          🏆 Kontribusi Client — Total Omzet 2026
        </div>
        ${_clients.map((c, i) => {
          const pct = Math.round(c.omzet / totalOmzet * 100);
          const w   = Math.min(pct * 1.5, 100);
          return `<div class="client-bar">
            <div style="font-size:10px;color:var(--text-3);width:18px">${i+1}</div>
            <div class="client-name">${c.nama}</div>
            <div class="client-track"><div class="client-fill" style="width:${w}%"></div></div>
            <div class="client-omzet">${_rp(c.omzet)}</div>
            <div class="client-pct">${pct}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  /* ══ TAB: OVERDUE ══ */
  function _renderOverdue() {
    return `
    <div class="inv-toolbar">
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:8px 14px;font-size:11px;color:#ef4444;font-weight:600">
        ⚠️ ${_overdue.length} invoice telah melewati jatuh tempo — Total: <strong>Rp125,3jt</strong>
      </div>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th style="padding:9px 8px;text-align:center;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;width:36px">#</th>
            <th style="padding:9px 12px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Customer</th>
            <th style="padding:9px 10px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Invoice #</th>
            <th style="padding:9px 10px;text-align:center;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Tgl Invoice</th>
            <th style="padding:9px 10px;text-align:center;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Jatuh Tempo</th>
            <th style="padding:9px 10px;text-align:center;color:#ef4444;font-size:10px;font-weight:700;text-transform:uppercase">Telat (hari)</th>
            <th style="padding:9px 10px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Total Invoice</th>
            <th style="padding:9px 10px;text-align:right;color:#ef4444;font-size:10px;font-weight:700;text-transform:uppercase">Sisa Tagihan</th>
          </tr>
        </thead>
        <tbody>
        ${_overdue.map((inv, i) => {
          const bg = i%2===0?'rgba(239,68,68,.03)':'rgba(239,68,68,.06)';
          const telat = Math.abs(inv.sisaHari);
          return `<tr onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(239,68,68,.1)'})"
                     onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"
                     style="border-bottom:1px solid var(--border)">
            <td style="padding:8px;text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${inv.no}</td>
            <td style="padding:8px 12px;font-weight:600;background:${bg}">${inv.customer}</td>
            <td style="padding:8px 10px;font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
            <td style="padding:8px 10px;text-align:center;font-size:10px;color:var(--text-2);background:${bg}">${_fmtDate(inv.tglInvoice)}</td>
            <td style="padding:8px 10px;text-align:center;font-size:10px;color:var(--text-2);background:${bg}">${_fmtDate(inv.tglBayar)||'—'}</td>
            <td style="padding:8px 10px;text-align:center;background:${bg}">
              <span style="font-weight:700;font-size:13px;color:#ef4444">-${telat > 999 ? '???' : telat}</span>
              <span style="font-size:9px;color:var(--text-3)"> hr</span>
            </td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg}">${_rp(inv.total)}</td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#ef4444;background:${bg}">${_rp(inv.sisa)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:rgba(239,68,68,.1);border-top:2px solid rgba(239,68,68,.3)">
          <td colspan="7" style="padding:8px 12px;font-weight:700;color:#ef4444">TOTAL OVERDUE</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:900;color:#ef4444">Rp125,3jt</td>
        </tr>
        </tbody>
      </table>
    </div>`;
  }

  /* ══ TAB: SOON DUE ══ */
  function _renderSoon() {
    return `
    <div class="inv-toolbar">
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:8px 14px;font-size:11px;color:#f59e0b;font-weight:600">
        🔔 ${_soon.length} invoice jatuh tempo dalam 15 hari ke depan — Total: <strong>Rp461,8jt</strong>
      </div>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th style="padding:9px 8px;text-align:center;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;width:36px">#</th>
            <th style="padding:9px 12px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Customer</th>
            <th style="padding:9px 10px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Invoice #</th>
            <th style="padding:9px 10px;text-align:center;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Tgl Invoice</th>
            <th style="padding:9px 10px;text-align:center;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Jatuh Tempo</th>
            <th style="padding:9px 10px;text-align:center;color:#f59e0b;font-size:10px;font-weight:700;text-transform:uppercase">Sisa Hari</th>
            <th style="padding:9px 10px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Total Invoice</th>
            <th style="padding:9px 10px;text-align:right;color:#f59e0b;font-size:10px;font-weight:700;text-transform:uppercase">Sisa Tagihan</th>
          </tr>
        </thead>
        <tbody>
        ${_soon.map((inv, i) => {
          const bg  = i%2===0?'transparent':'var(--surface2)';
          const col = inv.sisaHari <= 3 ? '#ef4444' : inv.sisaHari <= 7 ? '#f59e0b' : '#6366f1';
          const pct = Math.round((1 - inv.sisaHari/15) * 100);
          return `<tr onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(245,158,11,.07)'})"
                     onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"
                     style="border-bottom:1px solid var(--border)">
            <td style="padding:8px;text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${inv.no}</td>
            <td style="padding:8px 12px;font-weight:600;background:${bg}">${inv.customer}</td>
            <td style="padding:8px 10px;font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
            <td style="padding:8px 10px;text-align:center;font-size:10px;color:var(--text-2);background:${bg}">${_fmtDate(inv.tglInvoice)}</td>
            <td style="padding:8px 10px;text-align:center;font-size:10px;font-weight:600;background:${bg}">${_fmtDate(inv.tglBayar)}</td>
            <td style="padding:8px 10px;text-align:center;background:${bg}">
              <span style="font-weight:700;font-size:14px;color:${col}">${inv.sisaHari}</span>
              <span style="font-size:9px;color:var(--text-3)"> hari</span>
              <div style="width:50px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin:2px auto 0">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div>
              </div>
            </td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg}">${_rp(inv.total)}</td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:${col};background:${bg}">${_rp(inv.sisa)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:rgba(245,158,11,.08);border-top:2px solid rgba(245,158,11,.3)">
          <td colspan="7" style="padding:8px 12px;font-weight:700;color:#f59e0b">TOTAL SOON DUE</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:900;color:#f59e0b">Rp461,8jt</td>
        </tr>
        </tbody>
      </table>
    </div>`;
  }

  /* ─── CONTROLS ─── */
  function switchTab(tab) {
    _tab = tab;
    _renderFull();
  }
  function setSearch(val) {
    _search = (val||'').toLowerCase().trim();
    const el = document.getElementById('inv-content');
    if (el) el.innerHTML = _renderTabContent();
  }
  function setFilter(val) {
    _filterStatus = val;
    const el = document.getElementById('inv-content');
    if (el) el.innerHTML = _renderTabContent();
  }

  return { init, switchTab, setSearch, setFilter };
})();

window.InvoiceModule = InvoiceModule;
