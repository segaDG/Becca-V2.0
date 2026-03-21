/* ============================================
   BECCA V2.0 — Invoice / AR Module
   Data: AR2026 — 55 invoices lengkap
   Tabs: Daftar AR | Summary | Overdue | Soon Due
============================================ */

const InvoiceModule = (() => {
  let _tab = 'ar';
  let _search = '';
  let _filterStatus = 'all';

  /* ─── DATA ─── */
  const _invoices = [{"id":"inv_001","no":1,"customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07101152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":57124200,"afterPph":51834922,"totalTerbayar":57122200,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":2000,"status":"Paid"},{"id":"inv_002","no":2,"customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06701152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":39954600,"afterPph":39954600,"totalTerbayar":39954600,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv_003","no":3,"customer":"PT. DDMI","po":"","invoiceNum":"06601152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":18818940,"afterPph":17076445,"totalTerbayar":19357940,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv_004","no":4,"customer":"PT. DDMI","po":"","invoiceNum":"06601152601E","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":539000,"afterPph":489092,"totalTerbayar":0,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv_005","no":5,"customer":"PT. Akashi Wahana Indonesia","po":"0196/PO/AWI/I/26","invoiceNum":"06401152601","tglInvoice":"2026-02-03","tglBayar":"2026-02-18","sisaHari":null,"total":108816452,"afterPph":108816452,"totalTerbayar":106640123,"tglTerbayar":"2026-02-26","lamaTerbayar":"23 Hari","sisa":-44414,"status":"Paid"},{"id":"inv_006","no":6,"customer":"PT. Akashi Wahana Indonesia","po":"","invoiceNum":"064A14142601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":500000,"afterPph":500000,"totalTerbayar":500000,"tglTerbayar":"2026-01-23","lamaTerbayar":"4 Hari","sisa":-10204,"status":"Paid"},{"id":"inv_007","no":7,"customer":"SODEXO INDONESIA","po":"PO/G/26/01/20/2125","invoiceNum":"05101152601","tglInvoice":"2026-01-21","tglBayar":"2026-03-22","sisaHari":2,"total":124999600,"afterPph":113636000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":122499608,"status":"Unpaid"},{"id":"inv_008","no":8,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03001152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":61960500,"afterPph":61960500,"totalTerbayar":61960500,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_009","no":9,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A01152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-18","sisaHari":null,"total":30552480,"afterPph":30552480,"totalTerbayar":40413240,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_010","no":10,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B01152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-18","sisaHari":null,"total":9860760,"afterPph":9860760,"totalTerbayar":0,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_011","no":11,"customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06716312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":41601000,"afterPph":41601000,"totalTerbayar":41601000,"tglTerbayar":"2026-02-18","lamaTerbayar":"16 Hari","sisa":0,"status":"Paid"},{"id":"inv_012","no":12,"customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07116312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":68237400,"afterPph":61919122,"totalTerbayar":68279500,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":-42100,"status":"Paid"},{"id":"inv_013","no":13,"customer":"PT. DDMI","po":"","invoiceNum":"06619312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":34683306,"afterPph":31471888,"totalTerbayar":34683306,"tglTerbayar":"2026-02-27","lamaTerbayar":"25 Hari","sisa":0,"status":"Paid"},{"id":"inv_014","no":14,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062A01312601","tglInvoice":"2026-02-05","tglBayar":"2026-02-20","sisaHari":null,"total":43448400,"afterPph":39425400,"totalTerbayar":129275000,"tglTerbayar":"2026-02-27","lamaTerbayar":"22 Hari","sisa":1000,"status":"Paid"},{"id":"inv_015","no":15,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062B01312601R","tglInvoice":"2026-02-05","tglBayar":"2026-02-20","sisaHari":null,"total":85827600,"afterPph":77880600,"totalTerbayar":0,"tglTerbayar":"2026-02-27","lamaTerbayar":"22 Hari","sisa":0,"status":"Paid"},{"id":"inv_016","no":16,"customer":"SODEXO INDONESIA","po":"PO/G/26/02/04/3804","invoiceNum":"05116312601","tglInvoice":"2026-02-06","tglBayar":"2026-04-07","sisaHari":18,"total":136705250,"afterPph":124277500,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":133971145,"status":"Unpaid"},{"id":"inv_017","no":17,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03016312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":69516300,"afterPph":69516300,"totalTerbayar":69516300,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_018","no":18,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A16312601","tglInvoice":"2026-02-02","tglBayar":"2026-03-04","sisaHari":null,"total":34874280,"afterPph":34874280,"totalTerbayar":47892600,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_019","no":19,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B16312601","tglInvoice":"2026-02-02","tglBayar":"2026-03-04","sisaHari":null,"total":13018320,"afterPph":13018320,"totalTerbayar":0,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_020","no":20,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01016312601R","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":8,"total":72330300,"afterPph":65633050,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":72330300,"status":"Unpaid"},{"id":"inv_021","no":21,"customer":"PT. Akashi Wahana Indonesia","po":"","invoiceNum":"064A25252601","tglInvoice":"2026-02-03","tglBayar":"2026-02-18","sisaHari":null,"total":1488670,"afterPph":1488670,"totalTerbayar":1488670,"tglTerbayar":"2026-02-25","lamaTerbayar":"22 Hari","sisa":-30381,"status":"Paid"},{"id":"inv_022","no":22,"customer":"PT. SDM ( Outsource )","po":"","invoiceNum":"01016312601TR","tglInvoice":"2026-03-02","tglBayar":"2026-04-01","sisaHari":12,"total":11799200,"afterPph":10726545,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":11799200,"status":"Unpaid"},{"id":"inv_023","no":23,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01006062602","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":null,"total":1750000,"afterPph":1587962,"totalTerbayar":1750000,"tglTerbayar":"2026-03-09","lamaTerbayar":"26 Hari","sisa":0,"status":"Paid"},{"id":"inv_024","no":24,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01012122602","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":null,"total":2750000,"afterPph":2495370,"totalTerbayar":2750000,"tglTerbayar":"2026-03-16","lamaTerbayar":"33 Hari","sisa":0,"status":"Paid"},{"id":"inv_025","no":25,"customer":"PT. DDMI","po":"","invoiceNum":"06606062602E","tglInvoice":"2026-02-15","tglBayar":"2026-03-02","sisaHari":null,"total":188748,"afterPph":171271,"totalTerbayar":0,"tglTerbayar":"2026-03-10","lamaTerbayar":"23 Hari","sisa":0,"status":"Paid"},{"id":"inv_026","no":26,"customer":"SODEXO INDONESIA","po":"PO/G/26/02/20/5559","invoiceNum":"05101152602","tglInvoice":"2026-02-23","tglBayar":"2026-04-24","sisaHari":35,"total":128024600,"afterPph":116386000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":125464108,"status":"Unpaid"},{"id":"inv_027","no":27,"customer":"SODEXO INDONESIA","po":"PO/G/26/02/20/5560","invoiceNum":"05109092602","tglInvoice":"2026-02-23","tglBayar":"2026-04-24","sisaHari":35,"total":9350000,"afterPph":8500000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":9163000,"status":"Unpaid"},{"id":"inv_028","no":28,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A01152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-17","sisaHari":null,"total":33957000,"afterPph":33957000,"totalTerbayar":47892600,"tglTerbayar":"2026-02-27","lamaTerbayar":"12 Hari","sisa":0,"status":"Paid"},{"id":"inv_029","no":29,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B01152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-17","sisaHari":null,"total":13935600,"afterPph":13935600,"totalTerbayar":0,"tglTerbayar":"2026-02-27","lamaTerbayar":"12 Hari","sisa":0,"status":"Paid"},{"id":"inv_030","no":30,"customer":"PT. DDMI","po":"","invoiceNum":"06601152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-02","sisaHari":null,"total":20738472,"afterPph":18818243,"totalTerbayar":0,"tglTerbayar":"2026-03-10","lamaTerbayar":"23 Hari","sisa":0,"status":"Paid"},{"id":"inv_031","no":31,"customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07101152602","tglInvoice":"2026-02-17","tglBayar":"2026-03-04","sisaHari":null,"total":69418300,"afterPph":62990679,"totalTerbayar":69416300,"tglTerbayar":"2026-02-27","lamaTerbayar":"10 Hari","sisa":2000,"status":"Paid"},{"id":"inv_032","no":32,"customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06701152602R","tglInvoice":"2026-02-23","tglBayar":"2026-03-10","sisaHari":null,"total":41571600,"afterPph":41571600,"totalTerbayar":0,"tglTerbayar":"2026-03-16","lamaTerbayar":"21 Hari","sisa":0,"status":"Paid"},{"id":"inv_033","no":33,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03001152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-02","sisaHari":null,"total":70177800,"afterPph":70177800,"totalTerbayar":70177800,"tglTerbayar":"2026-02-27","lamaTerbayar":"12 Hari","sisa":0,"status":"Paid"},{"id":"inv_034","no":34,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01025252602","tglInvoice":"2026-02-25","tglBayar":"2026-04-11","sisaHari":22,"total":10638000,"afterPph":9653000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":10638000,"status":"Unpaid"},{"id":"inv_035","no":35,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01016282602R","tglInvoice":"2026-03-11","tglBayar":"2026-04-25","sisaHari":36,"total":47765160,"afterPph":43342460,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":47765160,"status":"Unpaid"},{"id":"inv_036","no":36,"customer":"SODEXO INDONESIA","po":"PO/G/26/03/02/6552","invoiceNum":"05116282602","tglInvoice":"2026-03-03","tglBayar":"2026-05-02","sisaHari":43,"total":112054800,"afterPph":101868000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":109813704,"status":"Unpaid"},{"id":"inv_037","no":37,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03016282602R","tglInvoice":"2026-03-04","tglBayar":"2026-03-19","sisaHari":null,"total":58397220,"afterPph":58397220,"totalTerbayar":58397220,"tglTerbayar":"2026-03-13","lamaTerbayar":"9 Hari","sisa":0,"status":"Paid"},{"id":"inv_038","no":38,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062A01282602R","tglInvoice":"2026-03-03","tglBayar":"2026-03-18","sisaHari":-2,"total":39625200,"afterPph":35956200,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":39625200,"status":"Overdue"},{"id":"inv_039","no":39,"customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062B01282602","tglInvoice":"2026-03-02","tglBayar":"2026-03-17","sisaHari":-3,"total":76642200,"afterPph":69545700,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":76642200,"status":"Overdue"},{"id":"inv_040","no":40,"customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06716282602","tglInvoice":"2026-03-02","tglBayar":"2026-03-17","sisaHari":null,"total":16787400,"afterPph":16787400,"totalTerbayar":58359000,"tglTerbayar":"2026-03-16","lamaTerbayar":"14 Hari","sisa":0,"status":"Paid"},{"id":"inv_041","no":41,"customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07116282602","tglInvoice":"2026-03-02","tglBayar":"2026-03-17","sisaHari":null,"total":40880700,"afterPph":37095450,"totalTerbayar":40880700,"tglTerbayar":"2026-03-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_042","no":42,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A16282602","tglInvoice":"2026-03-03","tglBayar":"2026-04-02","sisaHari":null,"total":22142120,"afterPph":22142120,"totalTerbayar":0,"tglTerbayar":"2026-03-16","lamaTerbayar":"13 Hari","sisa":0,"status":"Paid"},{"id":"inv_043","no":43,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B16282602","tglInvoice":"2026-03-03","tglBayar":"2026-04-02","sisaHari":null,"total":8635760,"afterPph":8635760,"totalTerbayar":30777880,"tglTerbayar":"2026-03-16","lamaTerbayar":"13 Hari","sisa":0,"status":"Paid"},{"id":"inv_044","no":44,"customer":"PT. Akashi Wahana Indonesia","po":"0813/PO/AWI/II/26","invoiceNum":"06416282602R","tglInvoice":"2026-03-10","tglBayar":"2026-03-25","sisaHari":5,"total":106870658,"afterPph":106870658,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":106870658,"status":"Unpaid"},{"id":"inv_045","no":45,"customer":"PT. DDMI","po":"","invoiceNum":"06616282602","tglInvoice":"2026-03-03","tglBayar":"2026-03-18","sisaHari":null,"total":10889360,"afterPph":9881085,"totalTerbayar":31816580,"tglTerbayar":"2026-03-10","lamaTerbayar":"7 Hari","sisa":0,"status":"Paid"},{"id":"inv_046","no":46,"customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01004042603","tglInvoice":"2026-03-05","tglBayar":"","sisaHari":null,"total":7938000,"afterPph":7203000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":7938000,"status":"Unpaid"},{"id":"inv_047","no":47,"customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07101152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":12,"total":43149400,"afterPph":39154085,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":43149400,"status":"Unpaid"},{"id":"inv_048","no":48,"customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06701152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":12,"total":14347200,"afterPph":14347200,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":14347200,"status":"Unpaid"},{"id":"inv_049","no":49,"customer":"PT. DDMI","po":"","invoiceNum":"06601152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":12,"total":23750478,"afterPph":21551359,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":23750478,"status":"Unpaid"},{"id":"inv_050","no":50,"customer":"SODEXO INDONESIA","po":"","invoiceNum":"05101152603","tglInvoice":"2026-03-17","tglBayar":"2026-05-16","sisaHari":57,"total":146207600,"afterPph":132916000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":143283448,"status":"Unpaid"},{"id":"inv_051","no":51,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A01122603","tglInvoice":"2026-03-12","tglBayar":"2026-04-11","sisaHari":22,"total":19276600,"afterPph":19276600,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":19276600,"status":"Unpaid"},{"id":"inv_052","no":52,"customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B01122603","tglInvoice":"2026-03-12","tglBayar":"2026-04-11","sisaHari":22,"total":7167720,"afterPph":7167720,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":7167720,"status":"Unpaid"},{"id":"inv_053","no":53,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"030A07072612","tglInvoice":"2026-03-15","tglBayar":"2026-03-30","sisaHari":10,"total":7350000,"afterPph":7350000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":7350000,"status":"Unpaid"},{"id":"inv_054","no":54,"customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03001152603","tglInvoice":"2026-03-15","tglBayar":"2026-03-30","sisaHari":10,"total":57188880,"afterPph":57188880,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":57188880,"status":"Unpaid"},{"id":"inv_055","no":55,"customer":"Event","po":"","invoiceNum":"09916162603","tglInvoice":"2026-03-16","tglBayar":"2026-03-16","sisaHari":-4,"total":1116000,"afterPph":1116000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":1116000,"status":"Overdue"}];

  const _monthly = [{"no":1,"bulan":"JANUARI","omzetInvoice":1066656558,"totalInvoice":22,"totalClient":10,"overdue":0,"unpaid":341076080,"pb1":60142629},{"no":2,"bulan":"FEBRUARI","omzetInvoice":943190698,"totalInvoice":23,"totalClient":9,"overdue":116267400,"unpaid":524254504,"pb1":52424116},{"no":3,"bulan":"MARET","omzetInvoice":320141878,"totalInvoice":9,"totalClient":8,"overdue":9054000,"unpaid":317483558,"pb1":20221033},{"no":4,"bulan":"APRIL","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":5,"bulan":"MEI","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":6,"bulan":"JUNI","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":7,"bulan":"JULI","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":8,"bulan":"AGUSTUS","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":9,"bulan":"SEPTEMBER","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":10,"bulan":"OKTOBER","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":11,"bulan":"NOVEMBER","omzetInvoice":0,"totalInvoice":0,"totalClient":0,"overdue":0,"unpaid":0,"pb1":0},{"no":12,"bulan":"DESEMBER","omzetInvoice":7350000,"totalInvoice":1,"totalClient":1,"overdue":0,"unpaid":7350000,"pb1":0}];

  const _overdue = _invoices.filter(i => i.status === 'Overdue');
  const _soon    = _invoices.filter(i => i.status === 'Unpaid' && i.sisaHari !== null && i.sisaHari >= 0 && i.sisaHari <= 15);
  const _clients = [{"nama":"SODEXO INDONESIA","omzet":597583500},{"nama":"PT. Shinto Kogyo Indonesia","omzet":331215000},{"nama":"PT. RESONAC MATERIALS INDONESIA","omzet":258157407},{"nama":"PT. DAIKI ALMUNIUM INDUSTRI IND","omzet":227355000},{"nama":"PT. Akashi Wahana Indonesia","omzet":222118142},{"nama":"SUPER STEEL KARAWANG","omzet":197368000},{"nama":"PT. NBC INDONESIA","omzet":157410000},{"nama":"PT. NUGRAHA INDAH CITARASA INDONESIA","omzet":132566166},{"nama":"PT. DDMI","omzet":101489170},{"nama":"PT. SDM ( Outsource )","omzet":10726545},{"nama":"Event","omzet":1116000}];

  /* ─── HELPERS ─── */
  function _rp(v) {
    const n = Number(v)||0;
    if (!n) return '-';
    if (Math.abs(n) >= 1e9) return 'Rp' + (n/1e9).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e6) return 'Rp' + (n/1e6).toFixed(1) + 'jt';
    return 'Rp' + n.toLocaleString('id');
  }
  function _rpFull(v) {
    const n = Number(v)||0;
    return n ? 'Rp' + n.toLocaleString('id') : '-';
  }
  function _statusBadge(inv) {
    const s = inv.status, d = inv.sisaHari;
    if (s === 'Paid')    return `<span class="inv-b paid">✓ Lunas</span>`;
    if (s === 'Overdue') return `<span class="inv-b overdue">⚠ ${Math.abs(d)} hr terlambat</span>`;
    if (d === null || d === undefined) return `<span class="inv-b info">⏱ Pending</span>`;
    const cls = d <= 3 ? 'urgent' : d <= 7 ? 'warn' : 'info';
    return `<span class="inv-b ${cls}">⏱ ${d} hari lagi</span>`;
  }
  function _fmtDate(s) {
    if (!s) return '-';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
    } catch(e) { return s; }
  }
  function _rowBg(i, inv) {
    if (inv.status === 'Overdue') return 'rgba(239,68,68,.04)';
    return i%2===0 ? 'var(--surface)' : 'var(--surface2)';
  }
  const HOV = 'rgba(99,102,241,.07)';
  const HOV_OV = 'rgba(239,68,68,.1)';
  function _hov(inv) {
    const hc = inv.status==='Overdue' ? HOV_OV : HOV;
    return `onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='${hc}'})" onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"`;
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-invoice');
    if (!page) return;
    _renderFull(page);
  }

  function _renderFull(page) {
    if (!page) page = document.getElementById('page-invoice');
    if (!page) return;

    const paid    = _invoices.filter(i=>i.status==='Paid').length;
    const unpaid  = _invoices.filter(i=>i.status==='Unpaid').length;
    const overdue = _overdue.length;
    const soonCnt = _soon.length;

    const totalOutstanding = _invoices.filter(i=>i.status!=='Paid').reduce((s,i)=>s+i.sisa,0);
    const totalOverdue     = _overdue.reduce((s,i)=>s+i.sisa,0);
    const totalSoon        = _soon.reduce((s,i)=>s+i.sisa,0);

    page.innerHTML = `
    <style>
      .inv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
      .inv-stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden}
      .inv-stat::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;background:var(--c)}
      .inv-stat-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3)}
      .inv-stat-val{font-size:20px;font-weight:900;color:var(--c);font-family:var(--font-mono);margin:4px 0 2px}
      .inv-stat-sub{font-size:11px;color:var(--text-3)}
      .inv-tabs{display:flex;gap:2px;border-bottom:2px solid var(--border);margin-bottom:0}
      .inv-tab{padding:10px 18px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:var(--text-3);border-bottom:2px solid transparent;margin-bottom:-2px;transition:.15s;border-radius:6px 6px 0 0}
      .inv-tab:hover{color:var(--text);background:rgba(99,102,241,.06)}
      .inv-tab.active{color:#6366f1;border-bottom-color:#6366f1;background:rgba(99,102,241,.08)}
      .inv-tab .cnt{display:inline-flex;align-items:center;justify-content:center;background:currentColor;border-radius:10px;font-size:9px;font-weight:700;padding:1px 6px;margin-left:6px;opacity:.85}
      .inv-tab .cnt span{color:#fff}
      .inv-b{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap}
      .inv-b.paid{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)}
      .inv-b.overdue{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
      .inv-b.urgent{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
      .inv-b.warn{background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.3)}
      .inv-b.info{background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.25)}
      .inv-card{background:var(--surface);border:1px solid var(--border);border-radius:0 0 12px 12px;overflow:hidden}
      .inv-toolbar{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .inv-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .inv-th{padding:9px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap}
      .inv-td{padding:8px 10px;border-bottom:1px solid var(--border)}
      .client-bar{padding:8px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
      .client-bar:last-child{border-bottom:none}
    </style>

    <div class="page-header">
      <div class="page-header-left">
        <h2>Account Receivable (AR) 2026</h2>
        <p>Piutang & monitoring invoice catering — data per 20 Maret 2026</p>
      </div>
    </div>

    <div class="inv-stats">
      <div class="inv-stat" style="--c:#6366f1">
        <div class="inv-stat-label">Total Omzet 2026</div>
        <div class="inv-stat-val">Rp2,34M</div>
        <div class="inv-stat-sub">${_invoices.length} invoice · ${paid} lunas · ${unpaid + overdue} pending</div>
      </div>
      <div class="inv-stat" style="--c:#f59e0b">
        <div class="inv-stat-label">Total Outstanding</div>
        <div class="inv-stat-val">${_rp(totalOutstanding)}</div>
        <div class="inv-stat-sub">${unpaid + overdue} invoice belum terbayar</div>
      </div>
      <div class="inv-stat" style="--c:#ef4444">
        <div class="inv-stat-label">Overdue</div>
        <div class="inv-stat-val">${_rp(totalOverdue)}</div>
        <div class="inv-stat-sub">${overdue} invoice melewati jatuh tempo</div>
      </div>
      <div class="inv-stat" style="--c:#10b981">
        <div class="inv-stat-label">Soon Due ≤15 Hari</div>
        <div class="inv-stat-val">${_rp(totalSoon)}</div>
        <div class="inv-stat-sub">${soonCnt} invoice segera jatuh tempo</div>
      </div>
    </div>

    <div class="inv-tabs">
      <button class="inv-tab ${_tab==='ar'?'active':''}" onclick="InvoiceModule.switchTab('ar')">
        📋 Daftar AR <div class="cnt"><span>${_invoices.length}</span></div>
      </button>
      <button class="inv-tab ${_tab==='summary'?'active':''}" onclick="InvoiceModule.switchTab('summary')">
        📊 Summary Bulanan
      </button>
      <button class="inv-tab ${_tab==='overdue'?'active':''}" onclick="InvoiceModule.switchTab('overdue')">
        ⚠️ Overdue <div class="cnt"><span>${overdue}</span></div>
      </button>
      <button class="inv-tab ${_tab==='soon'?'active':''}" onclick="InvoiceModule.switchTab('soon')">
        🔔 Soon Due <div class="cnt"><span>${soonCnt}</span></div>
      </button>
    </div>
    <div class="inv-card" id="inv-content">${_renderTabContent()}</div>`;
  }

  function _renderTabContent() {
    if (_tab==='ar')      return _renderAR();
    if (_tab==='summary') return _renderSummary();
    if (_tab==='overdue') return _renderOverdue();
    if (_tab==='soon')    return _renderSoon();
    return '';
  }

  /* ══ TAB AR ══ */
  function _renderAR() {
    let list = [..._invoices];
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
          style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
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
        ${list.length} inv &nbsp;·&nbsp;
        <span style="color:#10b981">✓${paid}</span> &nbsp;·&nbsp;
        <span style="color:#6366f1">⏱${unpaid}</span>
        ${overdue?` &nbsp;·&nbsp; <span style="color:#ef4444">⚠${overdue}</span>`:''}
      </span>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;min-width:950px;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th class="inv-th" style="text-align:center;width:36px">#</th>
            <th class="inv-th" style="text-align:left;min-width:180px">Customer</th>
            <th class="inv-th" style="text-align:left">Invoice #</th>
            <th class="inv-th" style="text-align:left">PO #</th>
            <th class="inv-th" style="text-align:center">Tgl Invoice</th>
            <th class="inv-th" style="text-align:center">Jatuh Tempo</th>
            <th class="inv-th" style="text-align:right">Total Invoice</th>
            <th class="inv-th" style="text-align:right">Terbayar</th>
            <th class="inv-th" style="text-align:center">Tgl Bayar</th>
            <th class="inv-th" style="text-align:right">Sisa</th>
            <th class="inv-th" style="text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>
        ${!list.length ? `<tr><td colspan="11" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data.</td></tr>` :
          list.map((inv,i) => {
            const bg = _rowBg(i, inv);
            return `<tr ${_hov(inv)} style="border-bottom:1px solid var(--border)">
              <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${inv.no}</td>
              <td class="inv-td" style="font-weight:600;background:${bg}">${inv.customer}</td>
              <td class="inv-td" style="font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
              <td class="inv-td" style="font-size:10px;color:var(--text-3);background:${bg}">${inv.po||'-'}</td>
              <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-2);background:${bg};white-space:nowrap">${_fmtDate(inv.tglInvoice)}</td>
              <td class="inv-td" style="text-align:center;font-size:10px;background:${bg};white-space:nowrap">${_fmtDate(inv.tglBayar)}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg}">${_rp(inv.total)}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);background:${bg};color:${inv.totalTerbayar?'#10b981':'var(--text-3)'}">${inv.totalTerbayar?_rp(inv.totalTerbayar):'-'}</td>
              <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-2);background:${bg};white-space:nowrap">${_fmtDate(inv.tglTerbayar)}${inv.lamaTerbayar?'<br><span style="font-size:9px;color:var(--text-3)">'+inv.lamaTerbayar+'</span>':''}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg};color:${inv.sisa>0?'#f59e0b':inv.sisa<0?'#ef4444':'var(--text-3)'}">${inv.sisa!==0?_rpFull(inv.sisa):'-'}</td>
              <td class="inv-td" style="text-align:center;background:${bg}">${_statusBadge(inv)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  /* ══ TAB SUMMARY ══ */
  function _renderSummary() {
    const totalOmzet = 2337339134;
    return `
    <div style="padding:16px">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px">
        <div style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);border-bottom:1px solid var(--border)">📅 Summary Bulanan 2026</div>
        <div class="inv-scroll">
          <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:700px">
            <thead>
              <tr style="background:var(--primary-h)">
                <th class="inv-th" style="text-align:left;width:36px">#</th>
                <th class="inv-th" style="text-align:left">Bulan</th>
                <th class="inv-th" style="text-align:right">Omzet Invoice</th>
                <th class="inv-th" style="text-align:center">Inv Terbit</th>
                <th class="inv-th" style="text-align:center">Client</th>
                <th class="inv-th" style="text-align:right;color:#ef4444">Overdue</th>
                <th class="inv-th" style="text-align:right;color:#f59e0b">Unpaid</th>
                <th class="inv-th" style="text-align:right">PB1</th>
              </tr>
            </thead>
            <tbody>
            ${_monthly.map((m,i) => {
              const bg = i%2===0?'var(--surface)':'var(--surface2)';
              const on = m.omzetInvoice > 0;
              return `<tr style="border-bottom:1px solid var(--border);opacity:${on?1:.45}">
                <td class="inv-td" style="font-size:10px;color:var(--text-3);background:${bg}">${m.no}</td>
                <td class="inv-td" style="font-weight:600;background:${bg}">${m.bulan}</td>
                <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;color:${on?'#6366f1':'var(--text-3)'};background:${bg}">${on?_rp(m.omzetInvoice):'-'}</td>
                <td class="inv-td" style="text-align:center;font-weight:600;background:${bg}">${on?m.totalInvoice:'-'}</td>
                <td class="inv-td" style="text-align:center;background:${bg}">${on?m.totalClient:'-'}</td>
                <td class="inv-td" style="text-align:right;font-family:var(--font-mono);color:${m.overdue>0?'#ef4444':'var(--text-3)'};background:${bg}">${m.overdue>0?_rp(m.overdue):'-'}</td>
                <td class="inv-td" style="text-align:right;font-family:var(--font-mono);color:${m.unpaid>0?'#f59e0b':'var(--text-3)'};background:${bg}">${m.unpaid>0?_rp(m.unpaid):'-'}</td>
                <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-3);background:${bg}">${m.pb1>0?_rp(m.pb1):'-'}</td>
              </tr>`;
            }).join('')}
            <tr style="background:rgba(99,102,241,.08);border-top:2px solid var(--border)">
              <td colspan="2" class="inv-td" style="font-weight:700">TOTAL YTD</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:900;color:#6366f1">Rp2,34M</td>
              <td class="inv-td" style="text-align:center;font-weight:700">55</td>
              <td class="inv-td" style="text-align:center;font-weight:700">11</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700;color:#ef4444">${_rp(_overdue.reduce((s,i)=>s+i.sisa,0))}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700;color:#f59e0b">Rp1,19M</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700">Rp132,8jt</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);border-bottom:1px solid var(--border)">🏆 Kontribusi Client 2026</div>
        ${_clients.map((c,i) => {
          const pct = Math.round(c.omzet/totalOmzet*100);
          const w   = Math.min(pct*1.5,100);
          return `<div class="client-bar">
            <div style="font-size:10px;color:var(--text-3);width:18px">${i+1}</div>
            <div style="font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nama}</div>
            <div style="flex:1;max-width:90px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="width:${w}%;height:100%;background:#6366f1;border-radius:3px"></div>
            </div>
            <div style="font-size:11px;font-family:var(--font-mono);color:var(--text-2);white-space:nowrap">${_rp(c.omzet)}</div>
            <div style="font-size:10px;color:var(--text-3);width:32px;text-align:right">${pct}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  /* ══ TAB OVERDUE ══ */
  function _renderOverdue() {
    const total = _overdue.reduce((s,i)=>s+i.sisa,0);
    return `
    <div class="inv-toolbar">
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:8px 14px;font-size:11px;color:#ef4444;font-weight:600">
        ⚠️ ${_overdue.length} invoice telah melewati jatuh tempo — Total: <strong>${_rp(total)}</strong>
      </div>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th class="inv-th" style="text-align:center;width:36px">#</th>
            <th class="inv-th" style="text-align:left">Customer</th>
            <th class="inv-th" style="text-align:left">Invoice #</th>
            <th class="inv-th" style="text-align:center">Tgl Invoice</th>
            <th class="inv-th" style="text-align:center">Jatuh Tempo</th>
            <th class="inv-th" style="text-align:center;color:#ef4444">Telat (hari)</th>
            <th class="inv-th" style="text-align:right">Total Invoice</th>
            <th class="inv-th" style="text-align:right;color:#ef4444">Sisa Tagihan</th>
          </tr>
        </thead>
        <tbody>
        ${_overdue.map((inv,i) => {
          const bg = 'rgba(239,68,68,.04)';
          const telat = Math.abs(inv.sisaHari);
          return `<tr ${_hov(inv)} style="border-bottom:1px solid var(--border)">
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${i+1}</td>
            <td class="inv-td" style="font-weight:600;background:${bg}">${inv.customer}</td>
            <td class="inv-td" style="font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-2);background:${bg}">${_fmtDate(inv.tglInvoice)}</td>
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-2);background:${bg}">${_fmtDate(inv.tglBayar)||'—'}</td>
            <td class="inv-td" style="text-align:center;background:${bg}">
              <span style="font-weight:700;font-size:13px;color:#ef4444">-${telat>999?'∞':telat}</span>
              <span style="font-size:9px;color:var(--text-3)"> hr</span>
            </td>
            <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg}">${_rp(inv.total)}</td>
            <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700;color:#ef4444;background:${bg}">${_rp(inv.sisa)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:rgba(239,68,68,.08);border-top:2px solid rgba(239,68,68,.3)">
          <td colspan="7" class="inv-td" style="font-weight:700;color:#ef4444">TOTAL OVERDUE</td>
          <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:900;color:#ef4444">${_rp(total)}</td>
        </tr>
        </tbody>
      </table>
    </div>`;
  }

  /* ══ TAB SOON DUE ══ */
  function _renderSoon() {
    const total = _soon.reduce((s,i)=>s+i.sisa,0);
    return `
    <div class="inv-toolbar">
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:8px 14px;font-size:11px;color:#f59e0b;font-weight:600">
        🔔 ${_soon.length} invoice jatuh tempo dalam 15 hari ke depan — Total: <strong>${_rp(total)}</strong>
      </div>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th class="inv-th" style="text-align:center;width:36px">#</th>
            <th class="inv-th" style="text-align:left">Customer</th>
            <th class="inv-th" style="text-align:left">Invoice #</th>
            <th class="inv-th" style="text-align:center">Tgl Invoice</th>
            <th class="inv-th" style="text-align:center">Jatuh Tempo</th>
            <th class="inv-th" style="text-align:center;color:#f59e0b">Sisa Hari</th>
            <th class="inv-th" style="text-align:right">Total Invoice</th>
            <th class="inv-th" style="text-align:right;color:#f59e0b">Sisa Tagihan</th>
          </tr>
        </thead>
        <tbody>
        ${_soon.map((inv,i) => {
          const bg  = i%2===0?'var(--surface)':'var(--surface2)';
          const col = inv.sisaHari<=3?'#ef4444':inv.sisaHari<=7?'#f59e0b':'#6366f1';
          const pct = Math.round((1-inv.sisaHari/15)*100);
          return `<tr onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(245,158,11,.07)'})" onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})" style="border-bottom:1px solid var(--border)">
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${i+1}</td>
            <td class="inv-td" style="font-weight:600;background:${bg}">${inv.customer}</td>
            <td class="inv-td" style="font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-2);background:${bg}">${_fmtDate(inv.tglInvoice)}</td>
            <td class="inv-td" style="text-align:center;font-size:10px;font-weight:600;background:${bg}">${_fmtDate(inv.tglBayar)}</td>
            <td class="inv-td" style="text-align:center;background:${bg}">
              <span style="font-weight:700;font-size:14px;color:${col}">${inv.sisaHari}</span>
              <span style="font-size:9px;color:var(--text-3)"> hari</span>
              <div style="width:50px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin:2px auto 0">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div>
              </div>
            </td>
            <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg}">${_rp(inv.total)}</td>
            <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700;color:${col};background:${bg}">${_rp(inv.sisa)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:rgba(245,158,11,.08);border-top:2px solid rgba(245,158,11,.3)">
          <td colspan="7" class="inv-td" style="font-weight:700;color:#f59e0b">TOTAL SOON DUE</td>
          <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:900;color:#f59e0b">${_rp(total)}</td>
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
