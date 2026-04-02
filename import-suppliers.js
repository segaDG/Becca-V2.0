// Run in browser console: copy-paste this entire script
// Import 41 suppliers from AP Supplier Detail PDF
(async () => {
  const suppliers = [
    {supplierCode:'01',nama:'PT. Dharmawan Putra Mandiri',bank:'Mandiri',noRek:'1730 0065 4536 3',atasNama:'Sega Dharmawan',kota:'Karawang',alamat:'',kategori:'General supplier',noHp:'081296617071'},
    {supplierCode:'02',nama:'Supriyadi',bank:'BCA',noRek:'4230334205',atasNama:'Supriyadi',kota:'Karawang',alamat:'Perum Gren Garden blok H2 No. 15',kategori:'Daging Beku',noHp:'085242497001'},
    {supplierCode:'03',nama:'PT. Kuda Merah Laksana',bank:'BRI',noRek:'33201001187307',atasNama:'Kuda Merah Laksana',kota:'Karawang',alamat:'Jl. STM Trijaya Sakti, Kp. Pasir Jengkol, Tanjungpura',kategori:'LPG',noHp:'(0267) 8406374'},
    {supplierCode:'04',nama:'CV. Mugi Amanah',bank:'Mandiri',noRek:'1560005438785',atasNama:'Ridi Widiastuti',kota:'Cikarang',alamat:'Kp. Kukun Ds. Ciantra Cikarang Selatan-Bekasi',kategori:'Kerupuk Matang',noHp:'081213848877'},
    {supplierCode:'05',nama:'Suman Agro Pangan',bank:'Mandiri',noRek:'1230005195757',atasNama:'Novi Sumanti',kota:'Bogor',alamat:'Cibubur country cluster cotton field CF3/1 Cikeas, Gunung Putri',kategori:'IKAN FROZEN',noHp:'081320312094'},
    {supplierCode:'06',nama:'UD. Naisa Buah',bank:'BRI',noRek:'744801004656537',atasNama:'Nur Istinganah',kota:'Karawang',alamat:'Jl. Raya Perumnas Bumi Telukjambe-Karawang',kategori:'Buah-buahan',noHp:'081314460489'},
    {supplierCode:'07',nama:'DPM',bank:'BCA',noRek:'6581068899',atasNama:'Sega Dharmawan',kota:'Tangerang',alamat:'',kategori:'Frozenfood & Box',noHp:''},
    {supplierCode:'08',nama:'UD. Buah Sejahtera',bank:'BCA',noRek:'5470314488',atasNama:'Irwan',kota:'Jakarta',alamat:'Pasar Induk Kramat Jati Jakarta Timur',kategori:'Buah-buahan',noHp:'08128525950'},
    {supplierCode:'09',nama:'Berkah Abadi Sukses',bank:'BCA',noRek:'3452652304',atasNama:'Istikomah',kota:'Karawang',alamat:'Pasar Johar Karawang',kategori:'Pisang',noHp:'085215543082'},
    {supplierCode:'10',nama:'CV. Indopangan Anugerah',bank:'BCA',noRek:'6240300425',atasNama:'indopangan Anugerah',kota:'Jakarta',alamat:'Pulo Gebang Permai Blok D 5 No. 24 Cakung-Jakarta 13950',kategori:'Sembako',noHp:'087888091211'},
    {supplierCode:'11',nama:'PD jasa sayur',bank:'BCA',noRek:'7045001521',atasNama:'Reka Priaska',kota:'Karawang',alamat:'Los III C No. 5-6 Pasar Baru Karawang',kategori:'Sayuran',noHp:'085770123905'},
    {supplierCode:'12',nama:'CV Maju Multi Abadi',bank:'BCA',noRek:'7035467190',atasNama:'CV Maju Makmur Abadi',kota:'Cikarang',alamat:'Deltamas Cikarang-Indonesia',kategori:'Sabun',noHp:'085100218896'},
    {supplierCode:'13',nama:'Lenko Surya Perkasa',bank:'Mandiri',noRek:'1320014057971',atasNama:'Lenko Surya Perkasa',kota:'Bekasi',alamat:'Jl. Raya Pasar Bojong',kategori:'Suplier Tisu',noHp:'081282057748'},
    {supplierCode:'14',nama:'Modernmobilindo',bank:'BCA',noRek:'1910188859',atasNama:'Saga Dharmawan',kota:'Tangerang',alamat:'Jl. KH. Ashim Ashari no 10, Cipondoh, Tangerang',kategori:'Rental Mobil',noHp:'087887741010'},
    {supplierCode:'15',nama:'PT. GreenBee',bank:'Mandiri',noRek:'1560033666779',atasNama:'PT GreenBe',kota:'Cikarang',alamat:'Jalan Kruing II No. 19 Delta Silicon, Lippo Cikarang, Bekasi',kategori:'Suplier Sabun',noHp:'(021)89909913'},
    {supplierCode:'16',nama:'PT LOTTE Grosir',bank:'BCA',noRek:'398302020034',atasNama:'LOTTE SHOPPING INDONESIA',kota:'Karawang',alamat:'Jl. Surotokunto, Warung Bambu, Kec. Karawang',kategori:'Suplier Sembako',noHp:'081296617071'},
    {supplierCode:'17',nama:'CV Sumber Pangan Nusantara',bank:'BCA',noRek:'54906928888',atasNama:'CV Sumber Pangan Nusantara',kota:'Karawang',alamat:'Perum Perumnas Bumi Telukjambe Blok S No. 15',kategori:'Suplier Daging',noHp:'0812 1108 9115'},
    {supplierCode:'18',nama:'UD. PANDAWA LIMA',bank:'BRI',noRek:'8015-01-002270-53-3',atasNama:'Syahri Majid',kota:'Karawang',alamat:'Pasar Johar Lantai Dasar Blok B3 No 90-108',kategori:'Jual Beli Sayur Mayur',noHp:'083915653319'},
    {supplierCode:'19',nama:'PT. Rasa Dapur Nusantara',bank:'Mandiri',noRek:'131-00-55598884',atasNama:'Segara Market',kota:'Bandung',alamat:'Jl. Brantas No. 30, Cihapit, Bandung Wetan, Kota Bandung 40114',kategori:'Beras',noHp:'081384216339'},
    {supplierCode:'20',nama:'PT. Gunung Inti Gemilang',bank:'BCA',noRek:'005-2989-777',atasNama:'PT. Gunung Inti Gemilang',kota:'Karawang',alamat:'Jl. Kh. Mansyur, No.Kav 129-130, Karet Tengsin, Tanah Abang, Jakarta Pusat',kategori:'Suplier Gas',noHp:'082144176167'},
    {supplierCode:'21',nama:'Toko Restu',bank:'BRI',noRek:'6060-01-026042-53-1',atasNama:'Umiroh',kota:'Karawang',alamat:'Pasar Johar Lantai Dasar Blok B3 No 90-108',kategori:'Suplier Plastik',noHp:'083805865183'},
    {supplierCode:'22',nama:'Aneka Buah Segar',bank:'BCA',noRek:'033-8355-643',atasNama:'Moch Muchsin',kota:'Karawang',alamat:'Jl. Interchange Karawang Barat, Perum Karaba Indah Blok XB No. 25',kategori:'Suplier Buah',noHp:'0812-9083-7977'},
    {supplierCode:'23',nama:'Kerupuk Sido Dadi',bank:'BCA',noRek:'343-092-0650',atasNama:'Herminingsih',kota:'Cikarang',alamat:'Gg. Topeng Cigebang, Ds. Cibening Kec. Setu',kategori:'Suplier Kerupuk',noHp:'0812-2558-8392'},
    {supplierCode:'24',nama:'PT. Segoro Enakabe Abadi',bank:'BCA',noRek:'574-572-3737',atasNama:'Kasmi Anggraeni',kota:'Karawang',alamat:'Jl. Pasir Panggang No. 08 Desa Wadas',kategori:'Suplier Minyak Kita (Catering Servis)',noHp:'0821-2822-8248'},
    {supplierCode:'25',nama:'UD. Sinar Barokah Buah',bank:'BCA',noRek:'164-050-6136',atasNama:'Hariyanto',kota:'Karawang',alamat:'Ps. Induk Modern Cikopo Blok C4 No. 11-12',kategori:'Suplier Pisang',noHp:'0813-1878-7828'},
    {supplierCode:'26',nama:'PT Lumbung Nusa Ntara Berdaya',bank:'BCA',noRek:'267-7033777',atasNama:'Lumbung Nusantara',kota:'Purwakarta',alamat:'Pasar Cikopo Purwakarta',kategori:'Suplier Sayuran',noHp:'0812-9787-1060'},
    {supplierCode:'27',nama:'MAXXIS GAS',bank:'BCA',noRek:'139-2388-898',atasNama:'Winarti Surya Endah Ningtyas',kota:'Karawang',alamat:'',kategori:'Suplier Gas',noHp:'0812-2111-1131'},
    {supplierCode:'28',nama:'Toko Masamba',bank:'Mandiri',noRek:'102-000-514-598-9',atasNama:'Sanjan Jaluddin',kota:'Karawang',alamat:'Jl. Johar-Karawang Timur',kategori:'Agen Sembako & Hasil Bumi',noHp:'0877-7666-4827'},
    {supplierCode:'29',nama:'Suplier Tempe&Tahu',bank:'BNI',noRek:'073-896-349-6',atasNama:'Haryanto',kota:'Karawang',alamat:'Pasar Baru Karawang',kategori:'Suplier Tahu&Tempe',noHp:'0812-8059-5791'},
    {supplierCode:'30',nama:'CV. Lumbung Jaya',bank:'Mandiri',noRek:'173-00-5566-000-6',atasNama:'CV. Lumbung Jaya',kota:'Karawang',alamat:'Jl. Wirasaba No. 100 Rt.003 Rw. 017 Kel. Ardiasa Bar Kec. Karawang Barat',kategori:'Suplier MamaSuka',noHp:'0267-407161'},
    {supplierCode:'31',nama:'Toko Krupuk Elin Herrlina',bank:'Mandiri',noRek:'156-00-1844-134-7',atasNama:'CV. Elin Herlina',kota:'Cikarang',alamat:'Kp. Pilar Timur Rt 001 Rw 008 Desa Karang Asih, kec. Cikarang Utara, Kab. Bekasi',kategori:'Suplier Krupuk',noHp:'0857-1475-7745'},
    {supplierCode:'32',nama:'Motric',bank:'Mandiri',noRek:'173-000-826-8881',atasNama:'PT. Bursa Molis Indonesia',kota:'Karawang',alamat:'Galuhmas',kategori:'Dealer Motor Listrik',noHp:''},
    {supplierCode:'33',nama:'PT. Sinar Terang Lancar',bank:'Mandiri',noRek:'173-000-250-6211',atasNama:'Wawu Winarsih',kota:'Karawang',alamat:'Perumnas Bumi Telukjambe Blok S No. 1',kategori:'Suplier Krupuk',noHp:'0818-0280-5670'},
    {supplierCode:'34',nama:'PT. JNR GAS NUSANTARA',bank:'BCA',noRek:'268-8978-799',atasNama:'PT. JNR Gas Nusantara',kota:'Tangerang',alamat:'Jl. Boston Barat I, Medang, Kec. Pagedangan, Kabupaten Tangerang',kategori:'Suplier Gas Nusantara',noHp:'0813-8792-6830'},
    {supplierCode:'35',nama:'Bu Elsa',bank:'Mandiri',noRek:'1730010785336',atasNama:'Elsa Yunita Dewi',kota:'Karawang',alamat:'',kategori:'Supplier Beras',noHp:'0858-6121-9999'},
    {supplierCode:'36',nama:'Krupuk L_@mpire',bank:'Mandiri',noRek:'1730010714328',atasNama:'Zelvy Libriyanti',kota:'Karawang',alamat:'Jl. HS Ronggo Waluyo Puserjaya Teluk Jambe',kategori:'Supplier Beras',noHp:'0858-8360-4933'},
    {supplierCode:'37',nama:'Bu Anna',bank:'Mandiri',noRek:'',atasNama:'',kota:'',alamat:'',kategori:'',noHp:''},
    {supplierCode:'38',nama:'Cakrawala Agro Lestari',bank:'Mandiri',noRek:'1560001913948',atasNama:'Johny Aris Subagyo',kota:'Bekasi',alamat:'Jl. Alamanda Raya Blok AA. 1 No. 55, Taman Alamanda, Tambun Utara-Bekasi',kategori:'Supplier Sembako',noHp:'0895-0626-0359'},
    {supplierCode:'39',nama:'PT. Buana Energy Bersama',bank:'Mandiri',noRek:'173-0019-0861-24',atasNama:'PT. Buana Energy Bersama',kota:'Karawang',alamat:'Perum Grand Permata Resindence, Blok A6 No 3 Desa Belendung Kec. Kelari',kategori:'Supplier Gas CNG',noHp:'0811-9226-987'},
    {supplierCode:'40',nama:'Kandang Sapi',bank:'BCA',noRek:'497-034-483-2',atasNama:'RPH Sumadi',kota:'',alamat:'Kandang Sapi',kategori:'Supplier Daging',noHp:''},
    {supplierCode:'41',nama:'Enggal Payu Supplier',bank:'BRI',noRek:'0995-0106-8305-538',atasNama:'Erita Sari',kota:'Karawang',alamat:'Jl. Amd Manunggal IV Ds. Pasir Awi Rt 04/01 No 40, Rawamerta',kategori:'Supplier Krupuk',noHp:'0811-1894-016'},
  ];

  // Load existing suppliers
  const existing = await DB.getSuppliers();
  const existingNames = new Set(existing.map(s => (s.nama||'').toLowerCase().trim()));

  let added = 0, skipped = 0;
  for (const s of suppliers) {
    if (existingNames.has(s.nama.toLowerCase().trim())) {
      // Update existing supplier with new data
      const ex = existing.find(e => (e.nama||'').toLowerCase().trim() === s.nama.toLowerCase().trim());
      if (ex) {
        const updated = { ...ex, ...s, id: ex.id };
        await DB.saveSupplier(updated);
        console.log('[UPDATE]', s.supplierCode, s.nama);
      }
      skipped++;
    } else {
      await DB.saveSupplier(s);
      console.log('[NEW]', s.supplierCode, s.nama);
      added++;
    }
  }
  console.log(`Done! Added: ${added}, Updated: ${skipped}`);
  alert(`Import selesai!\nBaru: ${added}\nUpdate: ${skipped}\n\nRefresh halaman untuk melihat data.`);
})();
