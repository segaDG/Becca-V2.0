/* ============================================
   BECCA V2.0 — Invoice / AR Module
   Tabs: Daftar AR | Summary | Overdue | Soon Due
   Data source: Supabase (DB.getInvoices())
   Historical seed: _SEED_INVOICES (55 records, seeded once on first load)
============================================ */

const InvoiceModule = (() => {
  let _tab            = 'ar';
  let _search         = '';
  let _filterStatus   = 'all';

  /* ─── LIVE DATA (loaded from DB) ─── */
  let _invoices = [];

  /* ─── HISTORICAL SEED (loaded once to DB if empty) ─── */
  const _SEED_INVOICES = [{"id":"inv_050","no":1,"customerId":"51","customer":"SODEXO INDONESIA","po":"","invoiceNum":"05101152603","tglInvoice":"2026-03-17","tglBayar":"2026-05-16","sisaHari":55,"total":146207600,"afterPph":132916000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":143283448,"status":"Unpaid"},{"id":"inv_049","no":2,"customerId":"66","customer":"PT. DDMI","po":"","invoiceNum":"06601152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":10,"total":23750478,"afterPph":21551359,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":23750478,"status":"Unpaid"},{"id":"inv_048","no":3,"customerId":"67","customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06701152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":10,"total":14347200,"afterPph":14347200,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":14347200,"status":"Unpaid"},{"id":"inv_047","no":4,"customerId":"71","customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07101152603","tglInvoice":"2026-03-17","tglBayar":"2026-04-01","sisaHari":10,"total":43149400,"afterPph":39154085,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":43149400,"status":"Unpaid"},{"id":"inv_055","no":5,"customerId":"","customer":"Event","po":"","invoiceNum":"09916162603","tglInvoice":"2026-03-16","tglBayar":"2026-03-16","sisaHari":null,"total":1116000,"afterPph":1116000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":1116000,"status":"Paid"},{"id":"inv_054","no":6,"customerId":"30","customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03001152603","tglInvoice":"2026-03-15","tglBayar":"2026-03-30","sisaHari":8,"total":57188880,"afterPph":57188880,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":57188880,"status":"Unpaid"},{"id":"inv_053","no":7,"customerId":"30","customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"030A07072612","tglInvoice":"2026-03-15","tglBayar":"2026-03-30","sisaHari":8,"total":7350000,"afterPph":7350000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":7350000,"status":"Unpaid"},{"id":"inv_052","no":8,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B01122603","tglInvoice":"2026-03-12","tglBayar":"2026-04-11","sisaHari":20,"total":7167720,"afterPph":7167720,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":7167720,"status":"Unpaid"},{"id":"inv_051","no":9,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A01122603","tglInvoice":"2026-03-12","tglBayar":"2026-04-11","sisaHari":20,"total":19276600,"afterPph":19276600,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":19276600,"status":"Unpaid"},{"id":"inv_035","no":10,"customerId":"10","customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01016282602R","tglInvoice":"2026-03-11","tglBayar":"2026-04-25","sisaHari":34,"total":47765160,"afterPph":43342460,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":47765160,"status":"Unpaid"},{"id":"inv_044","no":11,"customerId":"64","customer":"PT. Akashi Wahana Indonesia","po":"0813/PO/AWI/II/26","invoiceNum":"06416282602R","tglInvoice":"2026-03-10","tglBayar":"2026-03-25","sisaHari":3,"total":106870658,"afterPph":106870658,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":106870658,"status":"Unpaid"},{"id":"inv_046","no":12,"customerId":"10","customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01004042603","tglInvoice":"2026-03-05","tglBayar":"","sisaHari":null,"total":7938000,"afterPph":7203000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":7938000,"status":"Unpaid"},{"id":"inv_037","no":13,"customerId":"30","customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03016282602R","tglInvoice":"2026-03-04","tglBayar":"2026-03-19","sisaHari":null,"total":58397220,"afterPph":58397220,"totalTerbayar":58397220,"tglTerbayar":"2026-03-13","lamaTerbayar":"9 Hari","sisa":0,"status":"Paid"},{"id":"inv_036","no":14,"customerId":"51","customer":"SODEXO INDONESIA","po":"PO/G/26/03/02/6552","invoiceNum":"05116282602","tglInvoice":"2026-03-03","tglBayar":"2026-05-02","sisaHari":41,"total":112054800,"afterPph":101868000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":109813704,"status":"Unpaid"},{"id":"inv_039","no":15,"customerId":"62","customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062B01282602","tglInvoice":"2026-03-02","tglBayar":"2026-03-17","sisaHari":null,"total":76642200,"afterPph":69545700,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":76642200,"status":"Paid"},{"id":"inv_045","no":16,"customerId":"66","customer":"PT. DDMI","po":"","invoiceNum":"06616282602","tglInvoice":"2026-03-03","tglBayar":"2026-03-18","sisaHari":null,"total":10889360,"afterPph":9881085,"totalTerbayar":31816580,"tglTerbayar":"2026-03-10","lamaTerbayar":"7 Hari","sisa":0,"status":"Paid"},{"id":"inv_043","no":17,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B16282602","tglInvoice":"2026-03-03","tglBayar":"2026-04-02","sisaHari":null,"total":8635760,"afterPph":8635760,"totalTerbayar":30777880,"tglTerbayar":"2026-03-16","lamaTerbayar":"13 Hari","sisa":0,"status":"Paid"},{"id":"inv_042","no":18,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A16282602","tglInvoice":"2026-03-03","tglBayar":"2026-04-02","sisaHari":null,"total":22142120,"afterPph":22142120,"totalTerbayar":0,"tglTerbayar":"2026-03-16","lamaTerbayar":"13 Hari","sisa":0,"status":"Paid"},{"id":"inv_038","no":19,"customerId":"62","customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062A01282602R","tglInvoice":"2026-03-03","tglBayar":"2026-03-18","sisaHari":null,"total":39625200,"afterPph":35956200,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":39625200,"status":"Paid"},{"id":"inv_022","no":20,"customerId":"","customer":"PT. SDM ( Outsource )","po":"","invoiceNum":"01016312601TR","tglInvoice":"2026-03-02","tglBayar":"2026-04-01","sisaHari":10,"total":11799200,"afterPph":10726545,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":11799200,"status":"Paid"},{"id":"inv_041","no":21,"customerId":"71","customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07116282602","tglInvoice":"2026-03-02","tglBayar":"2026-03-17","sisaHari":null,"total":40880700,"afterPph":37095450,"totalTerbayar":40880700,"tglTerbayar":"2026-03-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_040","no":22,"customerId":"67","customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06716282602","tglInvoice":"2026-03-02","tglBayar":"2026-03-17","sisaHari":null,"total":16787400,"afterPph":16787400,"totalTerbayar":58359000,"tglTerbayar":"2026-03-16","lamaTerbayar":"14 Hari","sisa":0,"status":"Paid"},{"id":"inv_034","no":23,"customerId":"10","customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01025252602","tglInvoice":"2026-02-25","tglBayar":"2026-04-11","sisaHari":20,"total":10638000,"afterPph":9653000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":10638000,"status":"Unpaid"},{"id":"inv_027","no":24,"customerId":"51","customer":"SODEXO INDONESIA","po":"PO/G/26/02/20/5560","invoiceNum":"05109092602","tglInvoice":"2026-02-23","tglBayar":"2026-04-24","sisaHari":33,"total":9350000,"afterPph":8500000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":9163000,"status":"Unpaid"},{"id":"inv_026","no":25,"customerId":"51","customer":"SODEXO INDONESIA","po":"PO/G/26/02/20/5559","invoiceNum":"05101152602","tglInvoice":"2026-02-23","tglBayar":"2026-04-24","sisaHari":33,"total":128024600,"afterPph":116386000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":125464108,"status":"Unpaid"},{"id":"inv_032","no":26,"customerId":"67","customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06701152602R","tglInvoice":"2026-02-23","tglBayar":"2026-03-10","sisaHari":null,"total":41571600,"afterPph":41571600,"totalTerbayar":0,"tglTerbayar":"2026-03-16","lamaTerbayar":"21 Hari","sisa":0,"status":"Paid"},{"id":"inv_031","no":27,"customerId":"71","customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07101152602","tglInvoice":"2026-02-17","tglBayar":"2026-03-04","sisaHari":null,"total":69418300,"afterPph":62990679,"totalTerbayar":69416300,"tglTerbayar":"2026-02-27","lamaTerbayar":"10 Hari","sisa":2000,"status":"Paid"},{"id":"inv_025","no":28,"customerId":"66","customer":"PT. DDMI","po":"","invoiceNum":"06606062602E","tglInvoice":"2026-02-15","tglBayar":"2026-03-02","sisaHari":null,"total":188748,"afterPph":171271,"totalTerbayar":0,"tglTerbayar":"2026-03-10","lamaTerbayar":"23 Hari","sisa":0,"status":"Paid"},{"id":"inv_029","no":29,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B01152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-17","sisaHari":null,"total":13935600,"afterPph":13935600,"totalTerbayar":0,"tglTerbayar":"2026-02-27","lamaTerbayar":"12 Hari","sisa":0,"status":"Paid"},{"id":"inv_028","no":30,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A01152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-17","sisaHari":null,"total":33957000,"afterPph":33957000,"totalTerbayar":47892600,"tglTerbayar":"2026-02-27","lamaTerbayar":"12 Hari","sisa":0,"status":"Paid"},{"id":"inv_030","no":31,"customerId":"66","customer":"PT. DDMI","po":"","invoiceNum":"06601152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-02","sisaHari":null,"total":20738472,"afterPph":18818243,"totalTerbayar":0,"tglTerbayar":"2026-03-10","lamaTerbayar":"23 Hari","sisa":0,"status":"Paid"},{"id":"inv_033","no":32,"customerId":"30","customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03001152602","tglInvoice":"2026-02-15","tglBayar":"2026-03-02","sisaHari":null,"total":70177800,"afterPph":70177800,"totalTerbayar":70177800,"tglTerbayar":"2026-02-27","lamaTerbayar":"12 Hari","sisa":0,"status":"Paid"},{"id":"inv_020","no":33,"customerId":"10","customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01016312601R","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":6,"total":72330300,"afterPph":65633050,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":72330300,"status":"Unpaid"},{"id":"inv_024","no":34,"customerId":"10","customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01012122602","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":null,"total":2750000,"afterPph":2495370,"totalTerbayar":2750000,"tglTerbayar":"2026-03-16","lamaTerbayar":"33 Hari","sisa":0,"status":"Paid"},{"id":"inv_023","no":35,"customerId":"10","customer":"PT. NUGRAHA INDAH CITARASA INDONESIA","po":"","invoiceNum":"01006062602","tglInvoice":"2026-02-11","tglBayar":"2026-03-28","sisaHari":null,"total":1750000,"afterPph":1587962,"totalTerbayar":1750000,"tglTerbayar":"2026-03-09","lamaTerbayar":"26 Hari","sisa":0,"status":"Paid"},{"id":"inv_016","no":36,"customerId":"51","customer":"SODEXO INDONESIA","po":"PO/G/26/02/04/3804","invoiceNum":"05116312601","tglInvoice":"2026-02-06","tglBayar":"2026-04-07","sisaHari":16,"total":136705250,"afterPph":124277500,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":133971145,"status":"Unpaid"},{"id":"inv_015","no":37,"customerId":"62","customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062B01312601R","tglInvoice":"2026-02-05","tglBayar":"2026-02-20","sisaHari":null,"total":85827600,"afterPph":77880600,"totalTerbayar":0,"tglTerbayar":"2026-02-27","lamaTerbayar":"22 Hari","sisa":0,"status":"Paid"},{"id":"inv_014","no":38,"customerId":"62","customer":"PT. DAIKI ALMUNIUM INDUSTRI IND","po":"","invoiceNum":"062A01312601","tglInvoice":"2026-02-05","tglBayar":"2026-02-20","sisaHari":null,"total":43448400,"afterPph":39425400,"totalTerbayar":129275000,"tglTerbayar":"2026-02-27","lamaTerbayar":"22 Hari","sisa":1000,"status":"Paid"},{"id":"inv_021","no":39,"customerId":"64","customer":"PT. Akashi Wahana Indonesia","po":"","invoiceNum":"064A25252601","tglInvoice":"2026-02-03","tglBayar":"2026-02-18","sisaHari":null,"total":1488670,"afterPph":1488670,"totalTerbayar":1488670,"tglTerbayar":"2026-02-25","lamaTerbayar":"22 Hari","sisa":-30381,"status":"Paid"},{"id":"inv_005","no":40,"customerId":"64","customer":"PT. Akashi Wahana Indonesia","po":"0196/PO/AWI/I/26","invoiceNum":"06401152601","tglInvoice":"2026-02-03","tglBayar":"2026-02-18","sisaHari":null,"total":108816452,"afterPph":108816452,"totalTerbayar":106640123,"tglTerbayar":"2026-02-26","lamaTerbayar":"23 Hari","sisa":-44414,"status":"Paid"},{"id":"inv_011","no":41,"customerId":"67","customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06716312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":41601000,"afterPph":41601000,"totalTerbayar":41601000,"tglTerbayar":"2026-02-18","lamaTerbayar":"16 Hari","sisa":0,"status":"Paid"},{"id":"inv_012","no":42,"customerId":"71","customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07116312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":68237400,"afterPph":61919122,"totalTerbayar":68279500,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":-42100,"status":"Paid"},{"id":"inv_013","no":43,"customerId":"66","customer":"PT. DDMI","po":"","invoiceNum":"06619312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":34683306,"afterPph":31471888,"totalTerbayar":34683306,"tglTerbayar":"2026-02-27","lamaTerbayar":"25 Hari","sisa":0,"status":"Paid"},{"id":"inv_017","no":44,"customerId":"30","customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03016312601","tglInvoice":"2026-02-02","tglBayar":"2026-02-17","sisaHari":null,"total":69516300,"afterPph":69516300,"totalTerbayar":69516300,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_019","no":45,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B16312601","tglInvoice":"2026-02-02","tglBayar":"2026-03-04","sisaHari":null,"total":13018320,"afterPph":13018320,"totalTerbayar":0,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_018","no":46,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A16312601","tglInvoice":"2026-02-02","tglBayar":"2026-03-04","sisaHari":null,"total":34874280,"afterPph":34874280,"totalTerbayar":47892600,"tglTerbayar":"2026-02-13","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_007","no":47,"customerId":"51","customer":"SODEXO INDONESIA","po":"PO/G/26/01/20/2125","invoiceNum":"05101152601","tglInvoice":"2026-01-21","tglBayar":"2026-03-22","sisaHari":0,"total":124999600,"afterPph":113636000,"totalTerbayar":0,"tglTerbayar":"","lamaTerbayar":"","sisa":122499608,"status":"Unpaid"},{"id":"inv_001","no":48,"customerId":"71","customer":"PT. RESONAC MATERIALS INDONESIA","po":"","invoiceNum":"07101152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":57124200,"afterPph":51834922,"totalTerbayar":57122200,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":2000,"status":"Paid"},{"id":"inv_002","no":49,"customerId":"67","customer":"PT. NBC INDONESIA","po":"","invoiceNum":"06701152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":39954600,"afterPph":39954600,"totalTerbayar":39954600,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv_003","no":50,"customerId":"66","customer":"PT. DDMI","po":"","invoiceNum":"06601152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":18818940,"afterPph":17076445,"totalTerbayar":19357940,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv_004","no":51,"customerId":"66","customer":"PT. DDMI","po":"","invoiceNum":"06601152601E","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":539000,"afterPph":489092,"totalTerbayar":0,"tglTerbayar":"2026-01-27","lamaTerbayar":"8 Hari","sisa":0,"status":"Paid"},{"id":"inv_006","no":52,"customerId":"64","customer":"PT. Akashi Wahana Indonesia","po":"","invoiceNum":"064A14142601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":500000,"afterPph":500000,"totalTerbayar":500000,"tglTerbayar":"2026-01-23","lamaTerbayar":"4 Hari","sisa":-10204,"status":"Paid"},{"id":"inv_008","no":53,"customerId":"30","customer":"PT. Shinto Kogyo Indonesia","po":"","invoiceNum":"03001152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-03","sisaHari":null,"total":61960500,"afterPph":61960500,"totalTerbayar":61960500,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_009","no":54,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027A01152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-18","sisaHari":null,"total":30552480,"afterPph":30552480,"totalTerbayar":40413240,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"},{"id":"inv_010","no":55,"customerId":"27","customer":"SUPER STEEL KARAWANG","po":"","invoiceNum":"027B01152601","tglInvoice":"2026-01-19","tglBayar":"2026-02-18","sisaHari":null,"total":9860760,"afterPph":9860760,"totalTerbayar":0,"tglTerbayar":"2026-01-30","lamaTerbayar":"11 Hari","sisa":0,"status":"Paid"}];

  // Dynamic days-left — always relative to today (tidak pakai sisaHari hardcoded)
  function _daysLeft(tglBayar) {
    if (!tglBayar) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(tglBayar); due.setHours(0,0,0,0);
    return Math.round((due - today) / 86400000);
  }
  function _getOverdue() {
    return _invoices.filter(i => {
      if (i.status === 'Paid') return false;
      if (i.status === 'Overdue') return true; // explicit overdue flag
      const d = _daysLeft(i.tglBayar);
      return d !== null && d < 0;             // jatuh tempo sudah lewat
    });
  }
  function _getSoon() {
    return _invoices.filter(i => {
      if (i.status === 'Paid') return false;
      const d = _daysLeft(i.tglBayar);
      return d !== null && d >= 0 && d <= 15;
    });
  }
  /* ─── COMPUTED: Monthly summary (dari _invoices) ─── */
  function _computeMonthly() {
    const NAMES = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
    const months = NAMES.map((b, i) => ({ no:i+1, bulan:b, omzetInvoice:0, totalInvoice:0, totalClient:0, overdue:0, unpaid:0, pb1:0 }));
    const clientsByMonth = {};
    // Build customer tax lookup from localStorage
    const _custTaxMap = {};
    try {
      const custs = JSON.parse(localStorage.getItem('becca_customers')||'[]');
      custs.forEach(c => {
        _custTaxMap[c.nama] = c;
        if (c.customerId) _custTaxMap[String(c.customerId)] = c;
      });
    } catch(e) {}
    _invoices.forEach(inv => {
      if (!inv.tglInvoice) return;
      const m = parseInt(inv.tglInvoice.slice(5,7), 10) - 1;
      if (m < 0 || m > 11) return;
      months[m].omzetInvoice += inv.total || 0;
      months[m].totalInvoice += 1;
      const custData = _custTaxMap[String(inv.customerId||'')] || _custTaxMap[inv.customer||''] || {};
      if (custData.pb1) months[m].pb1 += Math.round((inv.total || 0) * 0.1);
      if (inv.status !== 'Paid') months[m].unpaid += inv.sisa || 0;
      if (!clientsByMonth[m]) clientsByMonth[m] = new Set();
      if (inv.customerId || inv.customer) clientsByMonth[m].add(inv.customerId || inv.customer);
    });
    Object.entries(clientsByMonth).forEach(([m, set]) => { months[parseInt(m)].totalClient = set.size; });
    return months;
  }

  /* ─── COMPUTED: Client contribution (dari _invoices) ─── */
  function _computeClients() {
    const map = {};
    _invoices.forEach(inv => {
      const key = inv.customer || 'Unknown';
      if (!map[key]) map[key] = { nama:key, omzet:0, customerId:inv.customerId||'' };
      map[key].omzet += inv.total || 0;
    });
    return Object.values(map).sort((a,b) => b.omzet - a.omzet);
  }

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
    const s = inv.status;
    if (s === 'Paid') return `<span class="inv-b paid">✓ Lunas</span>`;
    const d = _daysLeft(inv.tglBayar);
    if (d === null || d === undefined) return `<span class="inv-b info">⏱ Pending</span>`;
    if (d < 0)  return `<span class="inv-b overdue">⚠ ${Math.abs(d)} hr terlambat</span>`;
    if (d === 0) return `<span class="inv-b urgent">⏱ Jatuh tempo hari ini!</span>`;
    const cls = d <= 3 ? 'urgent' : d <= 7 ? 'warn' : 'info';
    return `<span class="inv-b ${cls}">⏱ ${d} hari lagi</span>`;
  }
  function _fmtDate(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
    catch(e) { return s; }
  }
  function _rowBg(i, inv) {
    return i%2===0 ? 'var(--surface)' : 'var(--surface2)';
  }
  const HOV = 'rgba(99,102,241,.07)';
  function _hov() {
    return `onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='${HOV}'})" onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"`;
  }

  /* ─── INIT ─── */
  // Konversi record dari becca_order_invoices ke format _invoices
  function _convertOrderInv(rec, idx) {
    const today = new Date();
    const tglInv = rec.invoiceDate || today.toISOString().slice(0,10);
    // Hitung total dari totals object
    const totalQty = Object.values(rec.totals||{}).reduce((s,v)=>s+(Number(v)||0),0);
    const totalAmt = totalQty * 17500;
    return {
      id: 'order_inv_' + (rec.nomor||idx),
      no: idx + 1,
      customerId: (() => {
        try {
          const custs = JSON.parse(localStorage.getItem('becca_customers')||'[]');
          const c = custs.find(x=>x.nama===rec.customer);
          return c?.customerId || '';
        } catch(e){ return ''; }
      })(),
      customer:       rec.customer || '',
      po:             '',
      invoiceNum:     rec.nomor || '',
      tglInvoice:     tglInv,
      tglBayar:       '',
      sisaHari:       null,
      total:          totalAmt,
      afterPph:       Math.round(totalAmt * 0.9),
      totalTerbayar:  0,
      tglTerbayar:    '',
      lamaTerbayar:   '',
      sisa:           totalAmt,
      status:         'Unpaid',
      source:         'order',
    };
  }

  // Validasi: record invoice harus punya setidaknya customer atau invoiceNum
  function _isValidInv(inv) { return !!(inv && (inv.customer || inv.invoiceNum)); }

  async function init() {
    const page = document.getElementById('page-invoice');
    if (!page) return;

    // Load dari DB — filter skeleton rows (baris lama tanpa field bisnis)
    try {
      const raw = await DB.getInvoices();
      _invoices = raw.filter(_isValidInv);
    } catch(e) {
      console.warn('[InvoiceModule] DB.getInvoices error:', e);
      _invoices = [];
    }

    // One-time seed: jika hasil valid = 0 & belum pernah diseed
    // Pakai flag v3 agar re-seed otomatis setelah schema fix (data JSONB ditambahkan)
    if (_invoices.length === 0 && !localStorage.getItem('becca_inv_seeded_v3')) {
      localStorage.setItem('becca_inv_seeded_v3', '1');
      try {
        await Promise.all(_SEED_INVOICES.map(inv => DB.saveInvoice(Object.assign({}, inv))));
        const raw2 = await DB.getInvoices();
        _invoices = raw2.filter(_isValidInv);
        console.log('[InvoiceModule] seeded', _SEED_INVOICES.length, 'invoices → valid:', _invoices.length);
        if (!_invoices.length) _invoices = [..._SEED_INVOICES];
      } catch(e) {
        console.warn('[InvoiceModule] seed error:', e);
        _invoices = [..._SEED_INVOICES];
      }
    }

    // Merge order-invoices dari localStorage yang belum ada di DB
    try {
      const orderInvs = JSON.parse(localStorage.getItem('becca_order_invoices') || '[]');
      if (orderInvs.length) {
        const existingNums = new Set(_invoices.map(i => i.invoiceNum));
        const newEntries = orderInvs
          .filter(r => r.nomor && !existingNums.has(r.nomor))
          .map((r, i) => _convertOrderInv(r, _invoices.length + i));
        if (newEntries.length) {
          await Promise.all(newEntries.map(inv => DB.saveInvoice(Object.assign({}, inv)).catch(()=>{})));
          newEntries.reverse().forEach(e => _invoices.unshift(e));
        }
      }
    } catch(e) { console.warn('[InvoiceModule] order merge error:', e); }

    // Re-number untuk display (urut tglInvoice desc)
    _invoices.sort((a, b) => (b.tglInvoice || '').localeCompare(a.tglInvoice || ''));
    _invoices.forEach((inv, i) => { inv.no = i + 1; });

    _renderFull(page);
  }

  function _renderFull(page) {
    if (!page) page = document.getElementById('page-invoice');
    if (!page) return;

    const paid    = _invoices.filter(i=>i.status==='Paid').length;
    const unpaid  = _invoices.filter(i=>i.status!=='Paid').length;
    const _overdue = _getOverdue();
    const _soon    = _getSoon();
    const overdue = _overdue.length;
    const soonCnt = _soon.length;
    const totalOutstanding = _invoices.filter(i=>i.status!=='Paid').reduce((s,i)=>s+i.sisa,0);
    const totalOverdue     = _overdue.reduce((s,i)=>s+i.sisa,0);
    const totalSoon        = _soon.reduce((s,i)=>s+i.sisa,0);

    page.innerHTML = `
    <style>
      .inv-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px}
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
      .inv-card{background:var(--surface);border:1px solid var(--border);border-radius:0 0 12px 12px;overflow:clip}
      .inv-toolbar{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .inv-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .inv-th{padding:9px 8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap;text-align:center}
      .inv-td{padding:7px 8px;border-bottom:1px solid var(--border)}
      .client-bar{padding:8px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
      .client-bar:last-child{border-bottom:none}
    </style>

    <div class="page-header">
      <div class="page-header-left">
        <h2>Account Receivable (AR)</h2>
        <p>Piutang & monitoring invoice</p>
      </div>
    </div>

    <div class="inv-stats">
      <div class="inv-stat" style="--c:#6366f1">
        <div class="inv-stat-label">Total Omzet</div>
        <div class="inv-stat-val">${_rp(_invoices.reduce((s,i)=>s+(i.total||0),0))}</div>
        <div class="inv-stat-sub">${_invoices.length} invoice · ${paid} lunas · ${unpaid} pending</div>
      </div>
      <div class="inv-stat" style="--c:#f59e0b">
        <div class="inv-stat-label">Total Outstanding</div>
        <div class="inv-stat-val">${_rp(totalOutstanding)}</div>
        <div class="inv-stat-sub">${unpaid} invoice belum terbayar</div>
      </div>
      <div class="inv-stat" style="--c:#ef4444">
        <div class="inv-stat-label">Overdue</div>
        <div class="inv-stat-val">${overdue > 0 ? _rp(totalOverdue) : '—'}</div>
        <div class="inv-stat-sub">${overdue > 0 ? overdue+' invoice melewati jatuh tempo' : 'Tidak ada overdue ✓'}</div>
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
        ⚠️ Overdue ${overdue>0?`<div class="cnt"><span>${overdue}</span></div>`:''}
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
      i.invoiceNum.toLowerCase().includes(_search) ||
      (i.customerId||'').toLowerCase().includes(_search));
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
        <input id="inv-search" placeholder="Cari customer / invoice # / ID..." value="${_search}"
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
      <table style="width:100%;border-collapse:collapse;min-width:900px;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th class="inv-th" style="text-align:center;width:36px">#</th>
            <th class="inv-th" style="text-align:center;width:44px">ID</th>
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
        ${!list.length ? `<tr><td colspan="12" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data.</td></tr>` :
          list.map((inv,i) => {
            const bg = _rowBg(i, inv);
            return `<tr ${_hov()} style="border-bottom:1px solid var(--border);cursor:pointer"
              onclick="InvoiceModule.openInvDetail('${inv.id||inv.invoiceNum}')">
              <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${inv.no}</td>
              <td class="inv-td" style="text-align:center;background:${bg}">
                ${inv.customerId ? `<span style="font-size:9px;font-weight:700;font-family:var(--font-mono);background:rgba(99,102,241,.12);color:#6366f1;padding:2px 5px;border-radius:4px">${inv.customerId}</span>` : '<span style="color:var(--border2)">-</span>'}
              </td>
              <td class="inv-td" style="font-weight:600;background:${bg}">${inv.customer}</td>
              <td class="inv-td" style="font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
              <td class="inv-td" style="font-size:10px;color:var(--text-3);background:${bg}">${inv.po||'-'}</td>
              <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-2);background:${bg};white-space:nowrap">${_fmtDate(inv.tglInvoice)}</td>
              <td class="inv-td" style="text-align:center;font-size:10px;background:${bg};white-space:nowrap">${_fmtDate(inv.tglBayar)}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg}">${_rpFull(inv.total)}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);background:${bg};color:${inv.totalTerbayar?'#10b981':'var(--text-3)'}">${inv.totalTerbayar?_rpFull(inv.totalTerbayar):'-'}</td>
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
    const monthly  = _computeMonthly();
    const clients  = _computeClients();
    const totalOmz = _invoices.reduce((s,i)=>s+(i.total||0),0);
    const totalPb1 = _invoices.reduce((s,i)=>s+Math.round((i.total||0)*.1),0);
    const totalUnp = _invoices.filter(i=>i.status!=='Paid').reduce((s,i)=>s+(i.sisa||0),0);
    const totalInv = _invoices.length;
    const totalCli = new Set(_invoices.map(i=>i.customerId||i.customer).filter(Boolean)).size;

    return `
    <div style="padding:16px">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px">
        <div style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);border-bottom:1px solid var(--border)">📅 Summary Bulanan</div>
        <div class="inv-scroll">
          <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:600px">
            <thead>
              <tr style="background:var(--primary-h)">
                <th class="inv-th" style="text-align:left;width:36px">#</th>
                <th class="inv-th" style="text-align:left">Bulan</th>
                <th class="inv-th" style="text-align:right">Omzet Invoice</th>
                <th class="inv-th" style="text-align:center">Inv Terbit</th>
                <th class="inv-th" style="text-align:center">Client</th>
                <th class="inv-th" style="text-align:right;color:#f59e0b">Unpaid</th>
                <th class="inv-th" style="text-align:right">PB1 (10%)</th>
              </tr>
            </thead>
            <tbody>
            ${monthly.map((m,i) => {
              const bg = i%2===0?'var(--surface)':'var(--surface2)';
              const on = m.omzetInvoice > 0;
              return `<tr style="border-bottom:1px solid var(--border);opacity:${on?1:.45}">
                <td class="inv-td" style="font-size:10px;color:var(--text-3);background:${bg}">${m.no}</td>
                <td class="inv-td" style="font-weight:600;background:${bg}">${m.bulan}</td>
                <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;color:${on?'#6366f1':'var(--text-3)'};background:${bg}">${on?_rpFull(m.omzetInvoice):'-'}</td>
                <td class="inv-td" style="text-align:center;font-weight:600;background:${bg}">${on?m.totalInvoice:'-'}</td>
                <td class="inv-td" style="text-align:center;background:${bg}">${on?m.totalClient:'-'}</td>
                <td class="inv-td" style="text-align:right;font-family:var(--font-mono);color:${m.unpaid>0?'#f59e0b':'var(--text-3)'};background:${bg}">${m.unpaid>0?_rpFull(m.unpaid):'-'}</td>
                <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-3);background:${bg}">${m.pb1>0?_rpFull(m.pb1):'-'}</td>
              </tr>`;
            }).join('')}
            <tr style="background:rgba(99,102,241,.08);border-top:2px solid var(--border)">
              <td colspan="2" class="inv-td" style="font-weight:700">TOTAL YTD</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:900;color:#6366f1">${_rp(totalOmz)}</td>
              <td class="inv-td" style="text-align:center;font-weight:700">${totalInv}</td>
              <td class="inv-td" style="text-align:center;font-weight:700">${totalCli}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700;color:#f59e0b">${_rpFull(totalUnp)}</td>
              <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700">${_rp(totalPb1)}</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);border-bottom:1px solid var(--border)">🏆 Kontribusi Client</div>
        ${clients.map((c,i) => {
          const pct = totalOmz > 0 ? Math.round(c.omzet/totalOmz*100) : 0;
          const w   = Math.min(pct*1.5, 100);
          return `<div class="client-bar">
            <div style="font-size:10px;color:var(--text-3);width:18px">${i+1}</div>
            ${c.customerId ? `<span style="font-size:9px;font-weight:700;font-family:var(--font-mono);background:rgba(99,102,241,.1);color:#6366f1;padding:2px 5px;border-radius:4px;min-width:28px;text-align:center">${c.customerId}</span>` : '<span style="min-width:28px"></span>'}
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
    const overdueList = _getOverdue();
    if (!overdueList.length) {
      return `<div style="padding:48px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">✅</div>
        <div style="font-size:16px;font-weight:700;color:var(--text)">Tidak Ada Invoice Overdue</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:6px">Semua invoice dalam kondisi baik</div>
      </div>`;
    }
    const total = overdueList.reduce((s,i)=>s+i.sisa,0);
    return `
    <div class="inv-toolbar">
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:8px 14px;font-size:11px;color:#ef4444;font-weight:600">
        ⚠️ ${overdueList.length} invoice melewati jatuh tempo — Total: <strong>${_rp(total)}</strong>
      </div>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:rgba(239,68,68,.12)">
            <th class="inv-th" style="text-align:center;width:36px">#</th>
            <th class="inv-th" style="text-align:left">Customer</th>
            <th class="inv-th" style="text-align:left">Invoice #</th>
            <th class="inv-th" style="text-align:center">Jatuh Tempo</th>
            <th class="inv-th" style="text-align:center;color:#ef4444">Terlambat</th>
            <th class="inv-th" style="text-align:right;color:#ef4444">Sisa Tagihan</th>
          </tr>
        </thead>
        <tbody>
        ${overdueList.map((inv,i) => {
          const d   = Math.abs(_daysLeft(inv.tglBayar));
          const bg  = i%2===0?'var(--surface)':'var(--surface2)';
          return `<tr style="border-bottom:1px solid var(--border)"
            onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(239,68,68,.07)'})"
            onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})">
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${i+1}</td>
            <td class="inv-td" style="font-weight:600;background:${bg}">${inv.customer}</td>
            <td class="inv-td" style="font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
            <td class="inv-td" style="text-align:center;font-size:10px;font-weight:600;background:${bg}">${_fmtDate(inv.tglBayar)}</td>
            <td class="inv-td" style="text-align:center;background:${bg}">
              <span style="font-weight:700;font-size:14px;color:#ef4444">${d}</span>
              <span style="font-size:9px;color:var(--text-3)"> hari</span>
            </td>
            <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700;color:#ef4444;background:${bg}">${_rpFull(inv.sisa)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  /* ══ TAB SOON DUE ══ */
  function _renderSoon() {
    const soonList = _getSoon();
    const total = soonList.reduce((s,i)=>s+i.sisa,0);
    return `
    <div class="inv-toolbar">
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:8px 14px;font-size:11px;color:#f59e0b;font-weight:600">
        🔔 ${soonList.length} invoice jatuh tempo dalam 15 hari — Total: <strong>${_rp(total)}</strong>
      </div>
    </div>
    <div class="inv-scroll">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--primary-h)">
            <th class="inv-th" style="text-align:center;width:36px">#</th>
            <th class="inv-th" style="text-align:center;width:44px">ID</th>
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
        ${soonList.map((inv,i) => {
          const daysLeft = _daysLeft(inv.tglBayar) ?? 0;
          const bg  = i%2===0?'var(--surface)':'var(--surface2)';
          const col = daysLeft===0?'#ef4444':daysLeft<=3?'#ef4444':daysLeft<=7?'#f59e0b':'#6366f1';
          const pct = Math.round((1-daysLeft/15)*100);
          return `<tr onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(245,158,11,.07)'})" onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})" style="border-bottom:1px solid var(--border)">
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${i+1}</td>
            <td class="inv-td" style="text-align:center;background:${bg}">
              ${inv.customerId?`<span style="font-size:9px;font-weight:700;font-family:var(--font-mono);background:rgba(99,102,241,.12);color:#6366f1;padding:2px 5px;border-radius:4px">${inv.customerId}</span>`:'<span style="color:var(--border2)">-</span>'}
            </td>
            <td class="inv-td" style="font-weight:600;background:${bg}">${inv.customer}</td>
            <td class="inv-td" style="font-family:var(--font-mono);font-size:10px;color:var(--text-2);background:${bg}">${inv.invoiceNum||'-'}</td>
            <td class="inv-td" style="text-align:center;font-size:10px;color:var(--text-2);background:${bg}">${_fmtDate(inv.tglInvoice)}</td>
            <td class="inv-td" style="text-align:center;font-size:10px;font-weight:600;background:${bg}">${_fmtDate(inv.tglBayar)}</td>
            <td class="inv-td" style="text-align:center;background:${bg}">
              <span style="font-weight:700;font-size:14px;color:${col}">${daysLeft===0?'HARI INI':daysLeft}</span>
              ${daysLeft>0?'<span style="font-size:9px;color:var(--text-3)"> hari</span>':''}
              <div style="width:50px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin:2px auto 0">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div>
              </div>
            </td>
            <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:600;background:${bg}">${_rpFull(inv.total)}</td>
            <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:700;color:${col};background:${bg}">${_rpFull(inv.sisa)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:rgba(245,158,11,.08);border-top:2px solid rgba(245,158,11,.3)">
          <td colspan="8" class="inv-td" style="font-weight:700;color:#f59e0b">TOTAL SOON DUE</td>
          <td class="inv-td" style="text-align:right;font-family:var(--font-mono);font-weight:900;color:#f59e0b">${_rp(total)}</td>
        </tr>
        </tbody>
      </table>
    </div>`;
  }

  /* ─── DETAIL & REVISI ─── */

  // Cari invoice berdasarkan id atau invoiceNum
  function _findInv(key) {
    return _invoices.find(i => i.id === key || i.invoiceNum === key);
  }

  // Ambil data order terkait dari becca_order_invoices, fallback ke _invoices
  function _getOrderRec(invoiceNum) {
    try {
      const recs = JSON.parse(localStorage.getItem('becca_order_invoices') || '[]');
      const fromLS = recs.find(r => r.nomor === invoiceNum);
      if (fromLS) return fromLS;
      // Fallback: invoice yang disimpan di DB mungkin punya orderIds langsung
      const inv = _invoices.find(i => i.invoiceNum === invoiceNum && i.orderIds?.length);
      if (inv) return {
        nomor:    inv.invoiceNum,
        customer: inv.customer,
        dari:     inv.dari    || '',
        sampai:   inv.sampai  || '',
        orderIds: inv.orderIds || [],
        totals:   inv.totals  || {},
      };
    } catch(e) {}
    return null;
  }

  // Simpan perubahan nomor invoice ke becca_order_invoices
  function _updateOrderInvNomor(oldNomor, newNomor) {
    try {
      const recs = JSON.parse(localStorage.getItem('becca_order_invoices') || '[]');
      const idx = recs.findIndex(r => r.nomor === oldNomor);
      if (idx >= 0) {
        recs[idx].nomor = newNomor;
        localStorage.setItem('becca_order_invoices', JSON.stringify(recs));
      }
      // Update becca_orders yang invoiceRef = oldNomor
      const orders = JSON.parse(localStorage.getItem('becca_orders') || '[]');
      let changed = false;
      orders.forEach(o => {
        if (o.invoiceRef === oldNomor) { o.invoiceRef = newNomor; changed = true; }
      });
      if (changed) localStorage.setItem('becca_orders', JSON.stringify(orders));
    } catch(e) { console.warn('updateOrderInvNomor error', e); }
  }

  // Hitung nomor revisi: base + R suffix
  function _reviseNomor(nomor) {
    // Cari berapa R sudah ada
    const base = nomor.replace(/R+$/, '');
    const rCount = (nomor.match(/R+$/) || [''])[0].length;
    return base + 'R'.repeat(rCount + 1);
  }

  // Buka modal detail invoice
  function openInvDetail(key) {
    const inv = _findInv(key);
    if (!inv) return;

    const orderRec = _getOrderRec(inv.invoiceNum);
    const isFromOrder = !!orderRec;

    // Ambil order list untuk rekap editable
    let orderList = [];
    if (orderRec?.orderIds) {
      try {
        const allOrders = JSON.parse(localStorage.getItem('becca_orders')||'[]');
        orderList = allOrders.filter(o => orderRec.orderIds.includes(o.id));
        orderList.sort((a,b) => a.tglOrder.localeCompare(b.tglOrder));
      } catch(e) {}
    }

    const ALL_KEYS = ['breakfast','shift1','spare1','ot1','snack1',
                      'shift2','spare2','ot2','snack2',
                      'shift3','spare3','ot3','snack3','snackBerat'];
    const ALL_LABELS = {breakfast:'Breakfast',shift1:'Shift I',spare1:'Spare I',ot1:'OT1',snack1:'Snk1',
      shift2:'Shift II',spare2:'Spare II',ot2:'OT2',snack2:'Snk2',
      shift3:'Shift III',spare3:'Spare III',ot3:'OT3',snack3:'Snk3',snackBerat:'SnkBrt'};

    // Kolom yang aktif (ada datanya)
    const activeCols = ALL_KEYS.filter(k =>
      orderList.some(o => Number(o[k]) > 0) ||
      (orderRec?.totals && (orderRec.totals[k]||0) > 0)
    ).map(k => ({key:k, label:ALL_LABELS[k]||k}));

    const rKol = activeCols.length;

    // Build rekap editable table (hanya tampil jika isFromOrder)
    const rekapEditable = isFromOrder && orderList.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
          color:var(--text-3);margin-bottom:6px;display:flex;align-items:center;gap:8px">
          Rekapitulasi Order
          <span style="font-weight:400;color:var(--text-3);font-size:10px;text-transform:none">
            — edit langsung, nomor invoice akan berubah jika ada perubahan data
          </span>
        </div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px">
          <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:500px">
            <thead>
              <tr style="background:var(--primary-h)">
                <th style="padding:6px 8px;color:#fff;font-weight:700;text-align:center;white-space:nowrap">DD</th>
                <th style="padding:6px 8px;color:#fff;font-weight:700;text-align:center;white-space:nowrap">Bulan</th>
                ${activeCols.map(c=>`<th style="padding:6px 5px;color:#fff;font-weight:700;text-align:center">${c.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="rekap-edit-tbody">
              ${orderList.map((o,i)=>{
                const bg = i%2===0?'var(--surface)':'var(--surface2)';
                const dd = o.tglOrder?o.tglOrder.slice(8):'';
                const mm = o.tglOrder?o.tglOrder.slice(5,7):'';
                const bulan=['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][parseInt(mm)]||mm;
                return `<tr style="background:${bg};border-bottom:1px solid var(--border)" data-order-id="${o.id}">
                  <td style="padding:4px 6px;text-align:center;font-weight:700">${dd}</td>
                  <td style="padding:4px 6px;text-align:center;color:var(--text-3)">${bulan}</td>
                  ${activeCols.map(c=>`
                    <td style="padding:3px">
                      <input type="number" min="0" value="${Number(o[c.key])||0}"
                        data-order-id="${o.id}" data-key="${c.key}"
                        onchange="InvoiceModule._markChanged()"
                        style="width:52px;padding:3px 4px;text-align:center;border:1px solid var(--border);
                          border-radius:4px;background:var(--surface);color:var(--text);
                          font-size:11px;font-family:var(--font-mono)">
                    </td>`).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div id="rekap-changed-badge" style="display:none;margin-top:6px;padding:6px 10px;
          background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;
          font-size:11px;color:#f59e0b">
          ⚠ Ada perubahan — nomor invoice akan direvisi saat disimpan
        </div>
      </div>
    ` : '';

    const _detailModalId = Utils.uid();
    window._beccaDetailModalId = _detailModalId;
    Modal.open({
      id: _detailModalId,
      title: '🧾 Detail Invoice',
      size: 'modal-xl',
      body: `
        <style>
          .inv-det-row{display:grid;grid-template-columns:120px 1fr;gap:4px 12px;align-items:start;margin-bottom:5px}
          .inv-det-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)}
          .inv-det-val{font-size:12px;color:var(--text)}
        </style>

        <!-- Header info -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:8px">Info Invoice</div>
            <div class="inv-det-row"><span class="inv-det-lbl">Nomor</span>
              <span class="inv-det-val" id="det-nomor-display"
                style="font-family:var(--font-mono);font-weight:700;font-size:13px;color:#6366f1">${inv.invoiceNum||'-'}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">Customer</span>
              <span class="inv-det-val" style="font-weight:600">${inv.customer}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">Periode</span>
              <span class="inv-det-val">${orderRec?(_fmtDate(orderRec.dari)+' s/d '+_fmtDate(orderRec.sampai)):(inv.tglInvoice||'-')}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">Jatuh Tempo</span>
              <span class="inv-det-val">${_fmtDate(inv.tglBayar)||'-'}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">PO #</span>
              <span class="inv-det-val" style="font-family:var(--font-mono);font-size:11px">${inv.po||'-'}</span></div>
            ${inv.invoiceNum&&inv.invoiceNum.match(/R+$/) ? `
              <div style="margin-top:6px;padding:4px 8px;background:rgba(245,158,11,.1);
                border:1px solid rgba(245,158,11,.3);border-radius:5px;font-size:10px;color:#f59e0b">
                ⚠ Sudah direvisi ${inv.invoiceNum.match(/R+$/)[0].length}x
              </div>` : ''}
          </div>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:8px">Finansial</div>
            <div class="inv-det-row"><span class="inv-det-lbl">Total Invoice</span>
              <span class="inv-det-val" style="font-weight:700">${_rpFull(inv.total)}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">Terbayar</span>
              <span class="inv-det-val" style="color:${inv.totalTerbayar?'#10b981':'var(--text-3)'}">${inv.totalTerbayar?_rpFull(inv.totalTerbayar):'-'}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">Sisa</span>
              <span class="inv-det-val" style="color:${inv.sisa>0?'#f59e0b':inv.sisa<0?'#ef4444':'var(--text-3)'}">
                ${inv.sisa!==0?_rpFull(inv.sisa):'-'}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">Tgl Bayar</span>
              <span class="inv-det-val">${_fmtDate(inv.tglTerbayar)||'-'}${inv.lamaTerbayar?' <span style="font-size:10px;color:var(--text-3)">('+inv.lamaTerbayar+')</span>':''}</span></div>
            <div class="inv-det-row"><span class="inv-det-lbl">Status</span>
              <span class="inv-det-val">${_statusBadge(inv)}</span></div>
          </div>
        </div>

        <!-- Rekap editable -->
        ${rekapEditable}

        <!-- Payment edit -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:10px">💳 Edit Pembayaran</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <label style="font-size:10px;font-weight:700;color:var(--text-3);display:block;margin-bottom:4px">Total Terbayar (Rp)</label>
              <input type="number" id="pay-total" min="0" value="${inv.totalTerbayar||0}"
                style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-size:12px;font-family:var(--font-mono);box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:10px;font-weight:700;color:var(--text-3);display:block;margin-bottom:4px">Tanggal Bayar</label>
              <input type="date" id="pay-tgl" value="${inv.tglTerbayar||''}"
                style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);font-size:12px;box-sizing:border-box">
            </div>
          </div>
          <button class="btn btn-primary" onclick="InvoiceModule.savePayment('${inv.id||inv.invoiceNum}')"
            style="width:100%;padding:9px">
            💾 Simpan Pembayaran
          </button>
        </div>

        <!-- Action buttons -->
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;align-items:center">
          <button class="btn btn-ghost" onclick="Modal.close(window._beccaDetailModalId)">Tutup</button>
          <button class="btn" onclick="InvoiceModule._sendEmail('${inv.id||inv.invoiceNum}')"
            style="background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.35)">
            ✉ Kirim Email
          </button>
          <button class="btn" onclick="InvoiceModule._printFromDetail('${inv.id||inv.invoiceNum}')"
            style="background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.35)">
            🖨 Cetak / PDF
          </button>
          <button class="btn" onclick="InvoiceModule.deleteInv('${inv.id||inv.invoiceNum}')"
            style="background:rgba(239,68,68,.08);color:#ef4444;border:1px solid rgba(239,68,68,.3)">
            🗑 Hapus
          </button>
          ${isFromOrder ? `
          <button class="btn" id="btn-simpan-revisi"
            onclick="InvoiceModule.reviseInv('${inv.id||inv.invoiceNum}')"
            style="background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.35);opacity:.4;pointer-events:none">
            💾 Simpan Revisi
          </button>` : ''}
        </div>`,
      buttons: []
    });

    window._currentInvKey = inv.id || inv.invoiceNum;
  }

  // Dipanggil saat input rekap berubah
  function _markChanged() {
    const badge = document.getElementById('rekap-changed-badge');
    const btn   = document.getElementById('btn-simpan-revisi');
    if (badge) badge.style.display = 'block';
    if (btn) { btn.style.opacity='1'; btn.style.pointerEvents='auto'; }
  }

  // Simpan revisi: baca semua input → bandingkan → jika berubah → update + nomor R
  async function reviseInv(key) {
    const inv = _findInv(key);
    if (!inv) return;

    const orderRec = _getOrderRec(inv.invoiceNum);
    if (!orderRec?.orderIds) { Notify.warning('Data order tidak ditemukan untuk revisi'); return; }

    // Baca semua input perubahan
    const inputs = document.querySelectorAll('#rekap-edit-tbody input[data-order-id]');
    if (!inputs.length) return;

    // Load orders dari DB (memory-cached 5 menit) agar cross-device konsisten
    let allOrders;
    try { allOrders = await DB.getOrders(); }
    catch(e) {
      // Fallback ke localStorage jika DB tidak tersedia
      try { allOrders = JSON.parse(localStorage.getItem('becca_orders')||'[]'); }
      catch { Notify.error('Gagal baca data order'); return; }
    }
    if (!allOrders.length) { Notify.warning('Data order tidak ditemukan'); return; }

    // Kumpulkan perubahan per order id
    const changes = {};
    inputs.forEach(inp => {
      const oid = inp.dataset.orderId;
      const key2 = inp.dataset.key;
      const newVal = parseInt(inp.value) || 0;
      if (!changes[oid]) changes[oid] = {};
      changes[oid][key2] = newVal;
    });

    // Cek apakah ada yang berubah vs data asli
    let hasChange = false;
    allOrders.forEach(o => {
      if (!changes[o.id]) return;
      Object.entries(changes[o.id]).forEach(([k,newVal]) => {
        if ((Number(o[k])||0) !== newVal) hasChange = true;
      });
    });

    if (!hasChange) {
      Notify.info('Tidak ada perubahan data — nomor invoice tetap');
      Modal.close(window._beccaDetailModalId);
      return;
    }

    // Ada perubahan → terapkan ke becca_orders
    const oldNomor = inv.invoiceNum;
    const newNomor = _reviseNomor(oldNomor);

    allOrders.forEach(o => {
      if (!changes[o.id]) return;
      Object.entries(changes[o.id]).forEach(([k,newVal]) => {
        o[k] = newVal;
      });
      // Update invoiceRef ke nomor baru
      if (o.invoiceRef === oldNomor) o.invoiceRef = newNomor;
    });
    localStorage.setItem('becca_orders', JSON.stringify(allOrders));

    // Update totals di becca_order_invoices
    try {
      const recs = JSON.parse(localStorage.getItem('becca_order_invoices')||'[]');
      const recIdx = recs.findIndex(r => r.nomor === oldNomor);
      if (recIdx >= 0) {
        // Recalc totals dari order yang baru
        const updatedOrders = allOrders.filter(o => orderRec.orderIds.includes(o.id));
        const newTotals = {};
        ['breakfast','shift1','spare1','ot1','snack1','shift2','spare2','ot2','snack2',
         'shift3','spare3','ot3','snack3','snackBerat'].forEach(k => {
          newTotals[k] = updatedOrders.reduce((s,o)=>s+(Number(o[k])||0),0);
        });
        recs[recIdx].totals = newTotals;
        recs[recIdx].nomor  = newNomor;
        localStorage.setItem('becca_order_invoices', JSON.stringify(recs));
      }
    } catch(e) { console.warn('update order_invoices error', e); }

    // Update di _invoices (in-memory)
    inv.invoiceNum = newNomor;

    // Sync ke DB: changed orders + invoice dengan nomor baru
    try {
      const changedOrderIds = new Set(Object.keys(changes));
      allOrders.forEach(o => {
        if (changedOrderIds.has(o.id)) DB.saveOrder(Object.assign({}, o)).catch(()=>{});
      });
      await DB.saveInvoice(Object.assign({}, inv));
    } catch(e) { console.warn('[InvoiceModule] reviseInv DB sync error:', e); }

    Modal.close(window._beccaDetailModalId);
    Notify.success(`Revisi tersimpan: ${oldNomor} → ${newNomor}`);
    setTimeout(() => _renderFull(), 50);
  }

  // Simpan data pembayaran invoice
  async function savePayment(key) {
    const inv = _findInv(key);
    if (!inv) return;
    const totalTerbayar = parseInt(document.getElementById('pay-total')?.value) || 0;
    const tglTerbayar   = document.getElementById('pay-tgl')?.value || '';

    // Hitung lama terbayar dari tglInvoice
    let lamaTerbayar = '';
    if (tglTerbayar && inv.tglInvoice) {
      const diff = Math.round((new Date(tglTerbayar) - new Date(inv.tglInvoice)) / 86400000);
      if (diff >= 0) lamaTerbayar = diff + ' Hari';
    }

    inv.totalTerbayar = totalTerbayar;
    inv.tglTerbayar   = tglTerbayar;
    inv.lamaTerbayar  = lamaTerbayar;
    inv.sisa          = Math.max(0, (inv.total || 0) - totalTerbayar);
    inv.status        = totalTerbayar >= (inv.total || 0) ? 'Paid' : 'Unpaid';

    try {
      await DB.saveInvoice(Object.assign({}, inv));
      Notify.success('Pembayaran tersimpan ✓');
    } catch(e) {
      console.warn('[InvoiceModule] savePayment DB error:', e);
      Notify.error('Gagal simpan ke DB');
    }
    Modal.close(window._beccaDetailModalId);
    setTimeout(() => _renderFull(), 50);
  }

  // Cetak ulang dari detail modal
  function _printFromDetail(key) {
    const inv = _findInv(key);
    if (!inv) return;
    const orderRec = _getOrderRec(inv.invoiceNum);

    // Ambil order list dari becca_orders jika ada
    let orderList = [];
    if (orderRec?.orderIds) {
      try {
        const allOrders = JSON.parse(localStorage.getItem('becca_orders') || '[]');
        orderList = allOrders.filter(o => orderRec.orderIds.includes(o.id));
        orderList.sort((a,b) => a.tglOrder.localeCompare(b.tglOrder));
      } catch(e) {}
    }

    Modal.close(window._beccaDetailModalId);
    _openInvPrintWin(inv, orderRec, orderList);
  }

  // Kirim email invoice
  function _sendEmail(key) {
    const inv = _findInv(key);
    if (!inv) return;
    const orderRec = _getOrderRec(inv.invoiceNum);

    // Lookup email customer dari becca_customers
    let custEmail = '';
    let custPic   = '';
    try {
      const custs = JSON.parse(localStorage.getItem('becca_customers')||'[]');
      const c = custs.find(x => x.nama === inv.customer);
      custEmail = c?.email || '';
      custPic   = c?.pic   || '';
    } catch(e){}

    const rp = n => n ? `Rp ${Number(n).toLocaleString('id')}` : '-';
    const pb1  = Math.round((inv.total||0) * 0.10);
    const pph  = Math.round((inv.total||0) * 0.02);
    const grand = (inv.total||0) + pb1 - pph;

    const periodeStr = orderRec
      ? (_fmtDate(orderRec.dari) + ' s/d ' + _fmtDate(orderRec.sampai))
      : (_fmtDate(inv.tglInvoice)||'');

    // Email body — plain text ringkas
    const emailBody = encodeURIComponent(
`Yth. ${custPic||'Tim Finance'} - ${inv.customer},

Bersama email ini kami sampaikan Invoice #${inv.invoiceNum} untuk layanan catering periode ${periodeStr}.

RINGKASAN TAGIHAN
─────────────────────────────
Customer    : ${inv.customer}
No. Invoice : ${inv.invoiceNum}
Periode     : ${periodeStr}
─────────────────────────────
Subtotal    : ${rp(inv.total)}
Pb1 (10%)   : ${rp(pb1)}
PPh 23 (2%) : -${rp(pph)}
─────────────────────────────
TOTAL       : ${rp(grand)}
─────────────────────────────

Pembayaran mohon dilakukan dalam 45 hari ke rekening:
Bank Mandiri KC Karawang 17300
No. Rekening : 173-00-0153197-0
a/n PT. Boga Pangan Sentosa

Mohon cantumkan nomor invoice pada keterangan transfer.

Terima kasih atas kepercayaan Anda kepada kami.

Hormat kami,
PT. Boga Pangan Sentosa
Telp: 0267-8407252 | admin@pangansentosa.com
www.pangan.co.id`
    );

    const emailSubject = encodeURIComponent(
      `Invoice #${inv.invoiceNum} — ${inv.customer} — Periode ${periodeStr}`
    );

    // Buka modal konfirmasi email
    const emailModalId = Utils.uid();
    Modal.open({
      id: emailModalId,
      title: '✉ Kirim Invoice via Email',
      size: 'modal-lg',
      body: `
        <div style="margin-bottom:14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:8px">Detail Pengiriman</div>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 12px;align-items:center">
            <span style="font-size:11px;color:var(--text-3)">No. Invoice</span>
            <span style="font-weight:700;font-family:var(--font-mono);color:#6366f1">${inv.invoiceNum}</span>
            <span style="font-size:11px;color:var(--text-3)">Customer</span>
            <span style="font-weight:600">${inv.customer}</span>
            <span style="font-size:11px;color:var(--text-3)">Total Tagihan</span>
            <span style="font-weight:700;color:#10b981">${rp(grand)}</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email Penerima</label>
          <input class="form-control" id="email-to" type="email"
            value="${custEmail}"
            placeholder="finance@perusahaan.com"
            style="font-family:var(--font-mono)">
          ${!custEmail ? '<div style="font-size:10px;color:#f59e0b;margin-top:4px">⚠ Email customer belum diisi di data Customer</div>' : ''}
        </div>
        <div class="form-group">
          <label class="form-label">CC (opsional)</label>
          <input class="form-control" id="email-cc" type="email"
            placeholder="cc@pangansentosa.com"
            style="font-family:var(--font-mono)">
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:4px">
          <div style="font-size:10px;font-weight:700;color:var(--text-3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.07em">Preview Subject</div>
          <div style="font-size:11px;font-family:var(--font-mono);color:var(--text)">Invoice #${inv.invoiceNum} — ${inv.customer} — Periode ${periodeStr}</div>
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.2);border-radius:8px;font-size:10px;color:var(--text-3)">
          💡 Email akan dibuka di aplikasi email default kamu (Gmail, Outlook, dll). Kamu bisa review dan kirim dari sana. Lampirkan PDF invoice secara manual jika diperlukan.
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${emailModalId}')">Batal</button>
        <button class="btn btn-primary" onclick="InvoiceModule._doSendEmail('${emailModalId}','${encodeURIComponent(inv.invoiceNum)}','${encodeURIComponent(inv.customer)}','${encodeURIComponent(periodeStr)}','${encodeURIComponent(rp(grand))}')">
          ✉ Buka di Email
        </button>`
    });
  }

  function _doSendEmail(modalId, invNumEnc, custEnc, periodeEnc, totalEnc) {
    const to      = document.getElementById('email-to')?.value?.trim() || '';
    const cc      = document.getElementById('email-cc')?.value?.trim() || '';
    const invNum  = decodeURIComponent(invNumEnc);
    const cust    = decodeURIComponent(custEnc);
    const periode = decodeURIComponent(periodeEnc);
    const total   = decodeURIComponent(totalEnc);

    const subject = encodeURIComponent(`Invoice #${invNum} — ${cust} — Periode ${periode}`);
    const body    = encodeURIComponent(
`Yth. Tim Finance - ${cust},

Bersama email ini kami sampaikan Invoice #${invNum} untuk layanan catering periode ${periode}.

Total Tagihan : ${total}
No. Invoice   : ${invNum}

Mohon lakukan pembayaran dalam 45 hari ke:
Bank Mandiri No. Rek 173-00-0153197-0 a/n PT. Boga Pangan Sentosa
Cantumkan nomor invoice pada keterangan transfer.

Terima kasih.

PT. Boga Pangan Sentosa
Telp: 0267-8407252 | admin@pangansentosa.com`
    );

    let mailto = `mailto:${to}?subject=${subject}&body=${body}`;
    if (cc) mailto += `&cc=${encodeURIComponent(cc)}`;

    Modal.close(modalId);
    window.open(mailto, '_blank');
    Notify.success('Email dibuka di aplikasi email kamu');
  }

  // Print window untuk invoice yang sudah ada
  function _openInvPrintWin(inv, orderRec, orderList) {
    const C = { NAVY:'#3B4E87', NAVY_D:'#2C3B65', NAVY_M:'#4A5E99',
                BL:'#C9DAF8', BP:'#E8F0FE', SUB:'#ACC9FE',
                GRY:'#666666', GLT:'#AAAAAA', URL:'#0070C0', RED:'#FF0000' };
    const MONTHS_ID = {January:'Januari',February:'Februari',March:'Maret',
      April:'April',May:'Mei',June:'Juni',July:'Juli',August:'Agustus',
      September:'September',October:'Oktober',November:'November',December:'Desember'};

    const rp = n => n ? `Rp ${Number(n).toLocaleString('id')}` : '-';

    // Parse periode dari orderRec jika ada
    const tgl1 = orderRec?.dari ? new Date(orderRec.dari) : null;
    const tgl2 = orderRec?.sampai ? new Date(orderRec.sampai) : null;
    const sd = tgl1 ? tgl1.getDate() : '--';
    const ed = tgl2 ? tgl2.getDate() : '--';
    const mth = tgl1 ? Object.values(MONTHS_ID)[tgl1.getMonth()] : '';
    const yr  = tgl1 ? tgl1.getFullYear() : '';
    const periodeStr = tgl1 && tgl2 ? `${sd} – ${ed} ${mth} ${yr}` : '--';

    // Kolom aktif dari order
    const ALL_COLS_KEYS = ['breakfast','shift1','spare1','ot1','snack1',
                           'shift2','spare2','ot2','snack2',
                           'shift3','spare3','ot3','snack3','snackBerat'];
    const ALL_COLS_LABEL = {
      breakfast:'Breakfast',shift1:'Shift I',spare1:'Spare I',ot1:'OT1',snack1:'Snk1',
      shift2:'Shift II',spare2:'Spare II',ot2:'OT2',snack2:'Snk2',
      shift3:'Shift III',spare3:'Spare III',ot3:'OT3',snack3:'Snk3',snackBerat:'SnkBrt'
    };

    // Hitung kolom aktif dari orderRec.totals atau orderList
    let activeCols = [];
    if (orderRec?.totals) {
      activeCols = ALL_COLS_KEYS
        .filter(k => (orderRec.totals[k]||0) > 0)
        .map(k => ({ key: k, label: ALL_COLS_LABEL[k] || k }));
    } else if (orderList.length) {
      activeCols = ALL_COLS_KEYS
        .filter(k => orderList.some(o => Number(o[k]) > 0))
        .map(k => ({ key: k, label: ALL_COLS_LABEL[k] || k }));
    }

    // Lookup harga + pajak per customer dari becca_customers
    const _custData = (() => {
      try {
        const custs = JSON.parse(localStorage.getItem('becca_customers')||'[]');
        return custs.find(x => x.nama === inv.customer)
            || custs.find(x => x.customerId && String(x.customerId) === String(inv.customerId||''))
            || null;
      } catch(e){ return null; }
    })();
    const _custHargaMap = _custData ? {
      breakfast:_custData.hargaBreakfast||17500, shift1:_custData.hargaShift1||17500,
      spare1:_custData.hargaSpare1||17500,       ot1:_custData.hargaOT1||17500,
      snack1:_custData.hargaSnack1||17500,       shift2:_custData.hargaShift2||17500,
      spare2:_custData.hargaSpare2||17500,       ot2:_custData.hargaOT2||17500,
      snack2:_custData.hargaSnack2||17500,       shift3:_custData.hargaShift3||17500,
      spare3:_custData.hargaSpare3||17500,       ot3:_custData.hargaOT3||17500,
      snack3:_custData.hargaSnack3||17500,       snackBerat:_custData.hargaSnackBerat||17500,
    } : null;
    const _getHarga = key => _custHargaMap?.[key] ?? 17500;
    const hasPb1    = !!_custData?.pb1;
    const hasPph23  = !!_custData?.pph23;
    const pb1Rate   = 0.10, pph23Rate = 0.02;
    const subtotal  = inv.total || 0;
    const pb1Tax    = hasPb1   ? Math.round(subtotal * pb1Rate)   : 0;
    const pphTax    = hasPph23 ? Math.round(subtotal * pph23Rate) : 0;
    const grandTotal = subtotal + pb1Tax - pphTax;

    const coHeader = (docTitle, docNum) => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid ${C.NAVY};margin-bottom:0">
        <div>
          <div style="font-size:21px;font-weight:900;color:${C.NAVY_D}">PT. BOGA PANGAN SENTOSA</div>
          <div style="font-size:10px;color:${C.NAVY};font-style:italic;margin-top:2px">Your Best Catering Service</div>
          <div style="font-size:8px;color:${C.GRY};margin-top:4px;line-height:1.7">
            Perumnas Bumi Telukjambe, blok PB No.1 RT.006/020 Desa Sukaluyu<br>
            Kec. Telukjambe Timur, Kab. Karawang, Jawa Barat 41361<br>
            📞 0267-8407252 • admin@pangansentosa.com • <span style="color:${C.URL}">www.pangan.co.id</span>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:28px;font-weight:900;color:${C.NAVY}">${docTitle}</div>
          <div style="font-size:11px;font-weight:700;color:${C.NAVY_D};background:${C.BP};padding:3px 8px;border-radius:3px;margin-top:4px">#${docNum}</div>
        </div>
      </div>`;

    const billTo = `
      <div style="background:${C.NAVY};color:#fff;padding:4px 10px;font-weight:700;font-size:9px;letter-spacing:.08em;margin-top:6px">  BILL TO</div>
      <div style="padding:5px 10px 6px;border:1px solid #dde3f0;border-top:none;margin-bottom:6px">
        <div style="font-size:8px;color:${C.GRY}">Invoice Receiving</div>
        <div style="font-size:12px;font-weight:700;color:${C.NAVY_D};margin:2px 0">${inv.customer}</div>
      </div>`;

    const periodeBar = `
      <div style="display:flex;height:26px;margin-bottom:6px">
        <div style="background:${C.NAVY};color:#fff;display:flex;align-items:center;justify-content:center;padding:0 12px;font-weight:700;font-size:9px;white-space:nowrap;min-width:72px">PERIODE</div>
        <div style="background:${C.NAVY_M};color:#fff;display:flex;align-items:center;justify-content:center;flex:1;font-weight:700;font-size:12px">${periodeStr}</div>
      </div>`;

    const signArea = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px">
        <div style="display:flex;flex-direction:column;align-items:flex-start;min-width:180px">
          <div style="font-size:10px;color:#333;margin-bottom:46px">Karawang, ${periodeStr}</div>
          <div style="border-top:1px solid #333;width:160px;padding-top:3px;font-size:9px;color:${C.GRY}">Admin / Pembuat Invoice</div>
        </div>
        <div style="text-align:center;min-width:160px">
          <div style="margin-top:46px;border-top:1px solid #333;padding-top:3px">
            <div style="font-weight:700;font-size:10px">Manager / PIC</div>
            <div style="font-size:8px;color:${C.GRY}">${inv.customer}</div>
          </div>
        </div>
      </div>`;

    /* ── REKAP ── */
    let rekapTableHtml = '';
    if (orderList.length && activeCols.length) {
      const grpH = `<tr>
        <th style="background:${C.NAVY};color:#fff;padding:5px;font-size:9px;font-weight:700;text-align:left">#</th>
        <th style="background:${C.NAVY};color:#fff;padding:5px;font-size:9px;font-weight:700">DD</th>
        <th style="background:${C.NAVY};color:#fff;padding:5px;font-size:9px;font-weight:700">BULAN</th>
        ${activeCols.map(c=>`<th style="background:${C.NAVY};color:#fff;padding:5px;font-size:9px;font-weight:700;text-align:center">${c.label}</th>`).join('')}
        <th style="background:${C.NAVY};color:#fff;padding:5px;font-size:9px;font-weight:700;text-align:center">QTY</th>
        <th style="background:${C.NAVY};color:#fff;padding:5px;font-size:9px;font-weight:700;text-align:right">TOTAL</th>
      </tr>`;
      const dataRows = orderList.map((o,i) => {
        const stripe = i%2===0?'#ffffff':'${C.BP}';
        const dd = o.tglOrder ? o.tglOrder.slice(8) : '';
        const mm = tgl1 ? Object.values(MONTHS_ID)[tgl1.getMonth()] : '';
        const qty = activeCols.reduce((s,c)=>s+(Number(o[c.key])||0),0);
        return `<tr style="background:${i%2===0?'#ffffff':C.BP}">
          <td style="padding:4px 5px;border:1px solid #dde3f0;font-size:9px;text-align:center;color:${C.GRY}">${i+1}</td>
          <td style="padding:4px 5px;border:1px solid #dde3f0;font-size:9px;text-align:center;font-weight:700">${dd}</td>
          <td style="padding:4px 5px;border:1px solid #dde3f0;font-size:9px;text-align:center">${mm}</td>
          ${activeCols.map(c=>`<td style="padding:4px 5px;border:1px solid #dde3f0;font-size:9px;text-align:center">${Number(o[c.key])||0||'–'}</td>`).join('')}
          <td style="padding:4px 5px;border:1px solid #dde3f0;font-size:9px;text-align:center;font-weight:700">${qty||'–'}</td>
          <td style="padding:4px 5px;border:1px solid #dde3f0;font-size:9px;text-align:right">${qty?rp(qty*_getHarga(c.key)):'–'}</td>
        </tr>`;
      }).join('');
      const subTots = activeCols.map(c => orderList.reduce((s,o)=>s+(Number(o[c.key])||0),0));
      const subQty = subTots.reduce((a,b)=>a+b,0);
      const subRow = `<tr style="background:${C.SUB}">
        <td colspan="3" style="padding:5px;border:1px solid #dde3f0;font-weight:700;font-size:9px;color:${C.NAVY_D}">SUB TOTAL</td>
        ${subTots.map(v=>`<td style="padding:5px;border:1px solid #dde3f0;font-weight:700;font-size:9px;text-align:center">${v||'–'}</td>`).join('')}
        <td style="padding:5px;border:1px solid #dde3f0;font-weight:700;font-size:9px;text-align:center">${subQty}</td>
        <td style="padding:5px;border:1px solid #dde3f0;font-weight:700;font-size:9px;text-align:right">${rp(activeCols.reduce((s,c,i)=>s+subTots[i]*_getHarga(c.key),0))}</td>
      </tr>`;
      rekapTableHtml = `<table style="width:100%;border-collapse:collapse">${grpH}${dataRows}${subRow}</table>`;
    } else {
      rekapTableHtml = `<div style="color:${C.GRY};font-size:10px;padding:16px;text-align:center">
        Data order detail tidak tersedia untuk invoice ini</div>`;
    }

    /* ── INVOICE ITEMS ── */
    let invItemsHtml = '';
    if (activeCols.length && orderRec?.totals) {
      const totals = orderRec.totals;
      invItemsHtml = activeCols.map((c,i) => {
        const qty = totals[c.key]||0;
        if (!qty) return '';
        const descMap = {
          shift1:'Food Catering Service Shift I — Makan Siang',
          shift2:'Food Catering Service Shift II — Makan Sore',
          shift3:'Food Catering Service Shift III — Makan Malam',
          snack1:'Food Catering Service Shift I — Snack',
          snack2:'Food Catering Service Shift II — Takjil',
          snack3:'Food Catering Service Shift III — Takjil',
          ot1:'Food Catering Service — OT Shift I',
          ot2:'Food Catering Service — OT Shift II',
          ot3:'Food Catering Service — OT Shift III',
          spare1:'Food Catering Service — Spare I',
          spare2:'Food Catering Service — Spare II',
          spare3:'Food Catering Service — Spare III',
          snackBerat:'Food Catering Service — Snack Berat',
          breakfast:'Food Catering Service — Breakfast',
        };
        const stripe = i%2===0?'#ffffff':C.BP;
        return `<tr style="background:${stripe}">
          <td style="padding:5px 8px;border:1px solid #dde3f0;width:24px"></td>
          <td colspan="2" style="padding:5px 8px;border:1px solid #dde3f0;font-size:9px;text-align:left">${descMap[c.key]||c.label}</td>
          <td style="padding:5px 8px;border:1px solid #dde3f0;font-size:9px;text-align:right">${rp(_getHarga(c.key))}</td>
          <td style="padding:5px 8px;border:1px solid #dde3f0;font-size:9px;text-align:center;font-weight:700">${qty}</td>
          <td style="padding:5px 8px;border:1px solid #dde3f0;font-size:9px;text-align:center"></td>
          <td style="padding:5px 8px;border:1px solid #dde3f0;width:18px"></td>
          <td style="padding:5px 8px;border:1px solid #dde3f0;font-size:9px;text-align:right;font-weight:700">${rp(qty*_getHarga(c.key))}</td>
        </tr>`;
      }).join('');
    } else {
      // Fallback: just show total
      invItemsHtml = `<tr>
        <td style="padding:5px 8px;border:1px solid #dde3f0"></td>
        <td colspan="2" style="padding:5px 8px;border:1px solid #dde3f0;font-size:9px">Food Catering Service</td>
        <td style="padding:5px 8px;border:1px solid #dde3f0"></td>
        <td style="padding:5px 8px;border:1px solid #dde3f0"></td>
        <td style="padding:5px 8px;border:1px solid #dde3f0"></td>
        <td style="padding:5px 8px;border:1px solid #dde3f0"></td>
        <td style="padding:5px 8px;border:1px solid #dde3f0;font-size:9px;text-align:right;font-weight:700">${rp(subtotal)}</td>
      </tr>`;
    }

    const css = `
      *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a2e;background:#fff}
      @page{size:A4 portrait;margin:12mm 12mm 14mm 12mm}
      @media print{
        .no-print{display:none!important}
        .page-break{page-break-before:always}
        body,*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      }
      .print-btn{position:fixed;top:14px;right:16px;padding:8px 20px;background:${C.NAVY};
        color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
        box-shadow:0 4px 14px rgba(59,78,135,.45);z-index:999}
      @media print{.print-btn{display:none!important}}
    `;

    const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><title>${inv.invoiceNum} — ${inv.customer}</title>
<style>${css}</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>

<!-- PAGE 1: REKAPITULASI -->
<div style="padding:0;max-width:210mm;margin:0 auto">
  ${coHeader('REKAPITULASI', inv.invoiceNum)}
  ${billTo}${periodeBar}
  <div style="background:${C.BL};padding:4px 10px;font-size:9px;font-weight:700;border-bottom:1px solid #aac4e8;margin-bottom:0">
    DESCRIPTION : FOOD CATERING SERVICE
  </div>
  ${rekapTableHtml}
  ${signArea}
</div>

<!-- PAGE 2: INVOICE -->
<div style="page-break-before:always;max-width:210mm;margin:0 auto">
  ${coHeader('INVOICE', inv.invoiceNum)}
  ${billTo}${periodeBar}

  <!-- Table DESCRIPTION -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:0">
    <thead>
      <tr style="background:${C.NAVY}">
        <th style="padding:6px 8px;color:#fff;font-size:9px;font-weight:700;border:1px solid ${C.NAVY_M};width:22px"></th>
        <th colspan="2" style="padding:6px 8px;color:#fff;font-size:9px;font-weight:700;border:1px solid ${C.NAVY_M};text-align:left">DESCRIPTION</th>
        <th style="padding:6px 8px;color:#fff;font-size:9px;font-weight:700;border:1px solid ${C.NAVY_M};width:88px">UNIT PRICE</th>
        <th style="padding:6px 8px;color:#fff;font-size:9px;font-weight:700;border:1px solid ${C.NAVY_M};width:46px">QTY</th>
        <th style="padding:6px 8px;color:#fff;font-size:9px;font-weight:700;border:1px solid ${C.NAVY_M};width:34px">TAXED<br>(Pb1)</th>
        <th style="padding:6px 8px;color:#fff;font-size:9px;font-weight:700;border:1px solid ${C.NAVY_M};width:18px"></th>
        <th style="padding:6px 8px;color:#fff;font-size:9px;font-weight:700;border:1px solid ${C.NAVY_M};width:88px;text-align:right">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${invItemsHtml}</tbody>
  </table>

  <!-- Totals + Comments -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;gap:16px">
    <div style="font-size:8.5px;color:${C.GRY};line-height:2;flex:1">
      <div style="font-size:9px;font-weight:700;color:${C.NAVY};background:${C.BL};padding:3px 8px;margin-bottom:4px;border-radius:3px">OTHER COMMENTS</div>
      <div>1. Total payment due in 45 days</div>
      <div>2. Please include the invoice number on your check</div>
      <div>3. PPh a/n PT. Boga Pangan Sentosa</div>
      <div>4. NPWP : 75.260.202.9-408.000</div>
      <div>5. NPWPD : 03.0012478.03.005</div>
    </div>
    <div style="min-width:290px;border:1px solid #dde3f0;border-radius:6px;overflow:hidden;flex-shrink:0">
      <div style="display:flex;justify-content:space-between;padding:5px 12px;border-bottom:${hasPb1||hasPph23?'1px':'2px'} solid ${hasPb1||hasPph23?'#eee':C.NAVY};background:#fafbff">
        <span style="font-weight:700;font-size:10px;color:${C.NAVY_D}">Subtotal</span>
        <span style="font-weight:700;font-size:11px;color:${C.NAVY_D}">${rp(subtotal)}</span>
      </div>
      ${hasPb1 ? `
      <div style="display:flex;justify-content:space-between;padding:4px 12px;border-bottom:1px solid #eee;font-size:9px;background:#fafbff">
        <span style="color:#555">Pb1</span><span style="font-weight:600">${(pb1Rate*100).toFixed(0)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 12px;border-bottom:1px solid #eee;font-size:9px;background:#fafbff">
        <span style="color:#555">Tax due (Pb1)</span><span style="font-weight:600">${rp(pb1Tax)}</span>
      </div>` : ''}
      ${hasPph23 ? `
      <div style="display:flex;justify-content:space-between;padding:4px 12px;border-bottom:1px solid #eee;font-size:9px;background:#fafbff">
        <span style="color:#555">PPh 23</span><span style="font-weight:600">${(pph23Rate*100).toFixed(0)}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 12px;border-bottom:2px solid ${C.NAVY};font-size:9px;background:#fafbff">
        <span style="color:#555">Tax due (PPh 23)</span>
        <span style="font-weight:600;color:${C.RED}">- ${rp(pphTax)}</span>
      </div>` : (hasPb1 ? `<div style="border-bottom:2px solid ${C.NAVY}"></div>` : '')}
      <div style="display:flex;justify-content:space-between;padding:7px 12px;background:${C.NAVY};color:#fff">
        <span style="font-weight:700;font-size:12px">TOTAL</span>
        <span style="font-weight:900;font-size:13px">${rp(grandTotal)}</span>
      </div>
    </div>
  </div>

  ${signArea}

  <!-- Bank -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:8px 14px;border:1px solid #dde3f0;border-radius:4px;font-size:8px;color:${C.GRY};background:#fafbff">
    <div>
      <div style="font-weight:700;color:#333;font-size:9px;margin-bottom:2px">Make all checks payable to <span style="color:${C.NAVY_D}">PT. BOGA PANGAN SENTOSA</span></div>
      Bank Mandiri KC Karawang 17300 • No. Rekening : <strong style="color:#333">173-00-0153197-0</strong>
    </div>
    <div style="border:1px dashed #bbb;width:86px;height:52px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#bbb;border-radius:4px;background:#f8f8f8">MATERAI</div>
  </div>
  <div style="background:${C.NAVY};color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:700;margin-top:12px">Thank You For Your Business! 🙏</div>
  <div style="text-align:center;font-size:8px;color:${C.GRY};padding:4px 0 0">If you have any questions, please contact &nbsp;Mr. Somat &nbsp;•&nbsp; +62 822-1033-8880 &nbsp;•&nbsp; umad@pangansentosa.com</div>
</div>

</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    if (!w) Notify.warning('Popup diblokir browser. Izinkan popup untuk halaman ini lalu coba lagi.');
  }

  /* ─── HAPUS INVOICE ─── */
  async function deleteInv(key) {
    const inv = _findInv(key);
    if (!inv) return;
    const label = inv.invoiceNum || inv.customer || key;
    if (!confirm(`Hapus invoice "${label}"?\n\nData ini tidak dapat dikembalikan.`)) return;

    // Hapus dari _invoices
    _invoices = _invoices.filter(i => i.id !== key && i.invoiceNum !== key);

    // Hapus dari DB
    try { await DB.deleteInvoice(inv.id || key); } catch(e) {}

    // Kembalikan orders ke status belum di-invoice
    try {
      // Hapus dari becca_order_invoices
      const recs = JSON.parse(localStorage.getItem('becca_order_invoices') || '[]');
      const filtered = recs.filter(r => r.nomor !== inv.invoiceNum);
      localStorage.setItem('becca_order_invoices', JSON.stringify(filtered));

      // Reset flag invoiced pada becca_orders + sync ke DB
      const orders = JSON.parse(localStorage.getItem('becca_orders') || '[]');
      const toSync = [];
      orders.forEach(o => {
        if (o.invoiceRef === inv.invoiceNum) {
          o.invoiced   = false;
          delete o.invoiceRef;
          delete o.invoiceDate;
          toSync.push(o);
        }
      });
      if (toSync.length) {
        localStorage.setItem('becca_orders', JSON.stringify(orders));
        toSync.forEach(o => DB.saveOrder({ ...o }).catch(() => {}));
      }
    } catch(e) {}

    Modal.close(window._beccaDetailModalId);
    Notify.success('Invoice ' + label + ' berhasil dihapus');
    _renderFull();
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

  return { init, switchTab, setSearch, setFilter, openInvDetail, reviseInv, savePayment, _printFromDetail, _markChanged, _sendEmail, _doSendEmail, deleteInv };
})();

window.InvoiceModule = InvoiceModule;
