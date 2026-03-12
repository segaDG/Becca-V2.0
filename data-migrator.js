/* ============================================
   BECCA V2.0 — Data Migrator
   Converts old BECCA data (array-of-arrays) → V2.0 objects
   Usage: paste di browser console, lalu jalankan BeccaMigrator.run()
   ============================================ */

const BeccaMigrator = (() => {

  /* ---------- KAS DATA ----------
     Old: [id, tgl, nama, type, vendor, qty, satuan, hargaSatuan, jumlah, penerima, status, bulan]
  */
  function migrateKas(rawArray) {
    return rawArray.map(r => ({
      id:          String(r[0]),
      tgl:         r[1],
      nama:        r[2],
      type:        r[3],
      vendor:      r[4] || '',
      qty:         parseFloat(r[5]) || 0,
      satuan:      r[6] || '',
      hargaSatuan: parseInt(r[7])   || 0,
      jumlah:      parseInt(r[8])   || 0,
      penerima:    r[9]  || '',
      status:      r[10] || 'DONE',
      bulan:       r[11] || '',
    }));
  }

  /* ---------- KAS MASUK ----------
     Old: [{ tgl, kredit }]
  */
  function migrateKasMasuk(rawArray) {
    return rawArray.map((r, i) => ({
      id:     'km_' + (i + 1),
      tgl:    r.tgl,
      kredit: parseInt(r.kredit) || 0,
    }));
  }

  /* ---------- INVENTORY PRODUCTS ----------
     Old: [id, nama, kategori, lokasi, status, satuan, minStock, harga,
           isHpp, totalMasuk, totalKeluar, balance]
  */
  function migrateInvProducts(rawArray) {
    return rawArray.map(r => ({
      id:          String(r[0]),
      nama:        r[1],
      kategori:    r[2] || '',
      lokasi:      r[3] || '',
      status:      r[4] || 'Activated',
      satuan:      r[5] || '',
      minStock:    parseFloat(r[6]) || 0,
      harga:       parseFloat(r[7]) || 0,
      isHpp:       !!r[8],
      totalMasuk:  parseFloat(r[9])  || 0,
      totalKeluar: parseFloat(r[10]) || 0,
      balance:     parseFloat(r[11]) || 0,
    }));
  }

  /* ---------- INVENTORY ACTIVITY ----------
     Old: [id, tgl, namaProduct, stockIn, stockOut, pengambil, pjawab,
           kodeAktivitas, catatan, isHpp, hargaSatuan, value?, nonHppFlag]
  */
  function migrateInvActivity(rawArray) {
    return rawArray.map(r => {
      const stockIn  = parseFloat(r[3]) || 0;
      const stockOut = parseFloat(r[4]) || 0;
      const harga    = parseFloat(r[10]) || 0;
      return {
        id:            String(r[0]),
        tgl:           r[1],
        namaProduct:   r[2],
        stockIn,
        stockOut,
        pengambil:     r[5] || '',
        pjawab:        r[6] || '',
        kodeAktivitas: r[7] || '',
        catatan:       r[8] || '',
        isHpp:         !!r[9],
        hargaSatuan:   harga,
        value:         parseFloat(r[11]) || Math.round((stockIn + stockOut) * harga),
      };
    });
  }

  /* ---------- EMPLOYEES ----------
     Old: object with snake_case keys
  */
  function migrateEmployees(rawArray) {
    return rawArray.map((e, i) => ({
      id:          'emp_' + (i + 1),
      nama:        e.nama         || '',
      panggilan:   e.panggilan    || '',
      nik:         e.nik          || '',
      status:      e.status       || 'ACTIVE',
      divisi:      e.divisi       || '',
      jabatan:     e.jabatan      || '',
      gajiAwal:    parseInt(e.gaji_awal) || 0,
      gaji:        parseInt(e.gaji)      || 0,
      ktp:         e.ktp          || '',
      tglLahir:    e.tgl_lahir    || '',
      tempatLahir: e.tempat_lahir || '',
      agama:       e.agama        || '',
      tglJoin:     e.tgl_join     || '',
      lama:        e.lama         || '',
      pendidikan:  e.pendidikan   || '',
      thumb:       e.thumb        || '',
      sisaHutang:  parseInt(e.sisa_hutang) || 0,
    }));
  }

  /* ---------- EMPLOYEE LOGS ----------
     Old: { bulan, tgl, nama, bayar, hutang, pj, ket, konfirmasi }
  */
  function migrateEmployeeLogs(rawArray) {
    return rawArray.map((l, i) => ({
      id:         'log_' + (i + 1),
      bulan:      l.bulan        || 0,
      tgl:        l.tgl          || '',
      nama:       l.nama         || '',
      bayar:      parseInt(l.bayar)  || 0,
      hutang:     parseInt(l.hutang) || 0,
      pj:         l.pj           || '',
      ket:        l.ket          || '',
      konfirmasi: l.konfirmasi   || '',
    }));
  }

  /* ---------- SAVE TO LOCALSTORAGE ---------- */
  function saveToLS(key, data) {
    localStorage.setItem('becca_' + key, JSON.stringify(data));
    console.log(`✅ ${key}: ${data.length} records saved`);
  }

  /* ---------- MAIN RUN ---------- */
  async function run() {
    console.log('🚀 BECCA Migrator V2.0 starting...');

    // Fetch all JSON files (jalankan di root repo atau sesuaikan path)
    const base = '.'; // ubah ke URL jika perlu

    try {
      const [kasRaw, kasMasukRaw, invProdRaw, invActRaw, empRaw, logRaw] = await Promise.all([
        fetch(`${base}/kas_data.json`).then(r=>r.json()),
        fetch(`${base}/kas_masuk_excel.json`).then(r=>r.json()),
        fetch(`${base}/inv_prod.json`).then(r=>r.json()),
        fetch(`${base}/inv_act.json`).then(r=>r.json()),
        fetch(`${base}/emp_data.json`).then(r=>r.json()),
        fetch(`${base}/log_data.json`).then(r=>r.json()),
      ]);

      const kas      = migrateKas(kasRaw);
      const kasMasuk = migrateKasMasuk(kasMasukRaw);
      const invProds = migrateInvProducts(invProdRaw);
      const invActs  = migrateInvActivity(invActRaw);
      const emps     = migrateEmployees(empRaw);
      const logs     = migrateEmployeeLogs(logRaw);

      saveToLS('kas',          kas);
      saveToLS('kas_masuk',    kasMasuk);
      saveToLS('inv_products', invProds);
      saveToLS('inventory',    invActs);
      saveToLS('employees',    emps);
      saveToLS('emp_logs',     logs);

      console.log('');
      console.log('📊 MIGRATION SUMMARY:');
      console.log(`   Kas Kecil    : ${kas.length} transaksi`);
      console.log(`   Kas Masuk    : ${kasMasuk.length} transaksi`);
      console.log(`   Inv Products : ${invProds.length} barang`);
      console.log(`   Inv Activity : ${invActs.length} aktivitas`);
      console.log(`   Employees    : ${emps.length} karyawan`);
      console.log(`   Employee Logs: ${logs.length} log`);
      console.log('');
      console.log('✅ Migration complete! Refresh halaman untuk lihat data.');

    } catch(err) {
      console.error('❌ Gagal fetch JSON:', err.message);
      console.log('💡 Tip: Jalankan dari folder yang berisi file JSON, atau ubah `base` URL.');
    }
  }

  /* ---------- EXPORT UNTUK MANUAL PASTE ---------- */
  function runManual(allData) {
    // allData = { kas, kasMasuk, invProd, invAct, emp, log }
    if (allData.kas)      saveToLS('kas',          migrateKas(allData.kas));
    if (allData.kasMasuk) saveToLS('kas_masuk',    migrateKasMasuk(allData.kasMasuk));
    if (allData.invProd)  saveToLS('inv_products', migrateInvProducts(allData.invProd));
    if (allData.invAct)   saveToLS('inventory',    migrateInvActivity(allData.invAct));
    if (allData.emp)      saveToLS('employees',    migrateEmployees(allData.emp));
    if (allData.log)      saveToLS('emp_logs',     migrateEmployeeLogs(allData.log));
    console.log('✅ Manual migration complete!');
  }

  return { run, runManual, migrateKas, migrateKasMasuk, migrateInvProducts,
           migrateInvActivity, migrateEmployees, migrateEmployeeLogs };
})();

window.BeccaMigrator = BeccaMigrator;

// Auto-print instructions
console.log('%c🔧 BECCA Migrator loaded!', 'color:#6366f1;font-weight:bold;font-size:14px');
console.log('Jalankan: BeccaMigrator.run()');
console.log('Atau manual: BeccaMigrator.runManual({ kas: [...], emp: [...] })');
