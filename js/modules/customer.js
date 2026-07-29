/* ============================================
   BECCA V2.0 — Customer Module
   Tabel lengkap sesuai Customer Sheet BPS Excel:
   No | Nama Perusahaan | Jenis Pelayanan | Harga/Pax | Biaya Box | Biaya Lainnya |
   Tempo | Potongan Ayam | Potongan Daging | Qty Lauk | Qty Pendamping |
   Breakfast | Shift1 | Spare1 | OT1 | Snack1 |
   Shift2 | Spare2 | OT2 | Snack2 |
   Shift3 | Spare3 | OT3 | Snack3 | Snack Berat |
   PIC | No HP | Kota | Status | Email | Catatan
============================================ */

const CustomerModule = (() => {
  let _data = [];
  let _search = '';
  let _sortCol = '';
  let _sortDir = 1;
  let _tab = 'aktif'; // 'aktif' | 'arsip'

  /* ── DEFAULT DATA dari Customer Sheet BPS ── */
  const _defaultData = [{"id":"cust_001_701d31","nama":"PT. TSURUTA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18000,"hargaShift1":18000,"hargaSpare1":16000,"hargaOT1":0,"hargaSnack1":0,"hargaShift2":18000,"hargaSpare2":18000,"hargaOT2":19000,"hargaSnack2":0,"hargaShift3":19000,"hargaSpare3":0,"hargaOT3":0,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"1"},{"id":"cust_002_0a3ffd","nama":"PT. FURUKAWA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":15000,"biayaBox":2000,"biayaLainnya":0,"tempo":45,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":12700,"hargaShift1":12700,"hargaSpare1":13000,"hargaOT1":13000,"hargaSnack1":5000,"hargaShift2":13000,"hargaSpare2":13000,"hargaOT2":13000,"hargaSnack2":5000,"hargaShift3":13000,"hargaSpare3":13000,"hargaOT3":13000,"hargaSnack3":5000,"hargaSnackBerat":0,"catatan":"","customerId":"2"},{"id":"cust_003_764755","nama":"PT. IFF KRW","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":27000,"biayaBox":0,"biayaLainnya":5000,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":13,"potonganDaging":25,"hargaBreakfast":21460,"hargaShift1":21460,"hargaSpare1":21460,"hargaOT1":21460,"hargaSnack1":6500,"hargaShift2":21460,"hargaSpare2":6500,"hargaOT2":33500,"hargaSnack2":6500,"hargaShift3":33500,"hargaSpare3":6500,"hargaOT3":33500,"hargaSnack3":6500,"hargaSnackBerat":33500,"catatan":"","customerId":"3"},{"id":"cust_004_3ca91b","nama":"PT. JTEKT","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":16500,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":15,"potonganDaging":30,"hargaBreakfast":5000,"hargaShift1":14210,"hargaSpare1":14210,"hargaOT1":14210,"hargaSnack1":9000,"hargaShift2":14210,"hargaSpare2":14210,"hargaOT2":14210,"hargaSnack2":9000,"hargaShift3":14210,"hargaSpare3":14210,"hargaOT3":14210,"hargaSnack3":9000,"hargaSnackBerat":0,"catatan":"","customerId":"4"},{"id":"cust_005_aaea7e","nama":"PT. IFF OTISTA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Paper Box","hargaPerPax":25000,"biayaBox":2000,"biayaLainnya":5000,"tempo":60,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":13,"potonganDaging":25,"hargaBreakfast":17500,"hargaShift1":17500,"hargaSpare1":17500,"hargaOT1":17500,"hargaSnack1":0,"hargaShift2":17500,"hargaSpare2":17500,"hargaOT2":17500,"hargaSnack2":0,"hargaShift3":17500,"hargaSpare3":17500,"hargaOT3":17500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"5"},{"id":"cust_006_289626","nama":"PT. GLOBAL","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13720,"hargaShift1":13720,"hargaSpare1":13720,"hargaOT1":13720,"hargaSnack1":0,"hargaShift2":13720,"hargaSpare2":13720,"hargaOT2":13720,"hargaSnack2":0,"hargaShift3":13720,"hargaSpare3":13720,"hargaOT3":13720,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"6"},{"id":"cust_007_f6ccb0","nama":"PT. MARUGO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":13000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":18,"potonganDaging":35,"hargaBreakfast":12740,"hargaShift1":12740,"hargaSpare1":12740,"hargaOT1":12740,"hargaSnack1":0,"hargaShift2":12740,"hargaSpare2":12740,"hargaOT2":12740,"hargaSnack2":0,"hargaShift3":12740,"hargaSpare3":12740,"hargaOT3":12740,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"7"},{"id":"cust_008_baad0c","nama":"PT. TOYOBO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":10500,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":10290,"hargaShift1":10290,"hargaSpare1":10290,"hargaOT1":10290,"hargaSnack1":0,"hargaShift2":10290,"hargaSpare2":10290,"hargaOT2":10290,"hargaSnack2":0,"hargaShift3":10290,"hargaSpare3":10290,"hargaOT3":10290,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"8"},{"id":"cust_009_f8f0e2","nama":"PT. NUGRAHA INDAH CITARASA INDONESIA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":1000,"tempo":60,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":15,"potonganDaging":30,"hargaBreakfast":16150,"hargaShift1":16150,"hargaSpare1":16150,"hargaOT1":16150,"hargaSnack1":0,"hargaShift2":16150,"hargaSpare2":16150,"hargaOT2":7000,"hargaSnack2":0,"hargaShift3":7000,"hargaSpare3":7000,"hargaOT3":7000,"hargaSnack3":0,"hargaSnackBerat":7000,"catatan":"","customerId":"10"},{"id":"cust_010_3b221d","nama":"AL-irsyad","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13720,"hargaShift1":13720,"hargaSpare1":13720,"hargaOT1":13720,"hargaSnack1":0,"hargaShift2":13720,"hargaSpare2":13720,"hargaOT2":13720,"hargaSnack2":0,"hargaShift3":13720,"hargaSpare3":13720,"hargaOT3":13720,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"9"},{"id":"cust_011_6e1374","nama":"PT. DAICHINDO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":17150,"hargaShift1":17150,"hargaSpare1":17150,"hargaOT1":17150,"hargaSnack1":0,"hargaShift2":17150,"hargaSpare2":17150,"hargaOT2":17150,"hargaSnack2":0,"hargaShift3":17150,"hargaSpare3":17150,"hargaOT3":17150,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"11"},{"id":"cust_012_7bead7","nama":"PT. SSK","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":2,"qtyPendamping":2,"potonganAyam":18,"potonganDaging":35,"hargaBreakfast":16660,"hargaShift1":16660,"hargaSpare1":16660,"hargaOT1":16660,"hargaSnack1":0,"hargaShift2":16660,"hargaSpare2":16660,"hargaOT2":10000,"hargaSnack2":0,"hargaShift3":16660,"hargaSpare3":16660,"hargaOT3":16660,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"12"},{"id":"cust_013_f86d31","nama":"PT. Shinto Kogyo Indonesia","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":15,"potonganDaging":30,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":5000,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"30"},{"id":"cust_014_b03d4a","nama":"PT. Osin","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"13"},{"id":"cust_015_59b0d7","nama":"PT. Dai-Ichi","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":16660,"hargaShift1":16660,"hargaSpare1":16660,"hargaOT1":16660,"hargaSnack1":0,"hargaShift2":16660,"hargaSpare2":16660,"hargaOT2":16660,"hargaSnack2":0,"hargaShift3":16660,"hargaSpare3":16660,"hargaOT3":16660,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"14"},{"id":"cust_016_ee594c","nama":"PT. Beta Pharmacon","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":16000,"biayaBox":1500,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14180,"hargaShift1":14180,"hargaSpare1":14180,"hargaOT1":14180,"hargaSnack1":0,"hargaShift2":14180,"hargaSpare2":14180,"hargaOT2":14180,"hargaSnack2":0,"hargaShift3":14180,"hargaSpare3":14180,"hargaOT3":14180,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"15"},{"id":"cust_017_0c65ef","nama":"PT. Hiruta","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":2000,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14660,"hargaShift1":14660,"hargaSpare1":14660,"hargaOT1":14660,"hargaSnack1":0,"hargaShift2":14660,"hargaSpare2":14660,"hargaOT2":14660,"hargaSnack2":0,"hargaShift3":14660,"hargaSpare3":14660,"hargaOT3":14660,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"16"},{"id":"cust_018_799c4c","nama":"Pangan Bento","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":20000,"biayaBox":0,"biayaLainnya":0,"tempo":0,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19600,"hargaShift1":19600,"hargaSpare1":19600,"hargaOT1":19600,"hargaSnack1":0,"hargaShift2":19600,"hargaSpare2":19600,"hargaOT2":19600,"hargaSnack2":0,"hargaShift3":19600,"hargaSpare3":19600,"hargaOT3":19600,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"17"},{"id":"cust_019_6b840a","nama":"PT. ACT","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"18"},{"id":"cust_020_776c31","nama":"PT. Piston Ring","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"19"},{"id":"cust_021_e3cdf3","nama":"PT. Softex","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":13500,"biayaBox":0,"biayaLainnya":0,"tempo":45,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13230,"hargaShift1":13230,"hargaSpare1":13230,"hargaOT1":13230,"hargaSnack1":0,"hargaShift2":13230,"hargaSpare2":13230,"hargaOT2":13230,"hargaSnack2":0,"hargaShift3":13230,"hargaSpare3":13230,"hargaOT3":13230,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"21"},{"id":"cust_022_c336d3","nama":"PT. IJSC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Paper Box","hargaPerPax":25000,"biayaBox":2000,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":22500,"hargaShift1":22500,"hargaSpare1":22500,"hargaOT1":22500,"hargaSnack1":0,"hargaShift2":22500,"hargaSpare2":22500,"hargaOT2":22500,"hargaSnack2":0,"hargaShift3":22500,"hargaSpare3":22500,"hargaOT3":22500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"22"},{"id":"cust_023_1f506f","nama":"PT. Toyoda Gosai","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":12000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":11760,"hargaShift1":11760,"hargaSpare1":11760,"hargaOT1":11760,"hargaSnack1":0,"hargaShift2":11760,"hargaSpare2":11760,"hargaOT2":11760,"hargaSnack2":0,"hargaShift3":11760,"hargaSpare3":11760,"hargaOT3":11760,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"23"},{"id":"cust_024_912b65","nama":"PT. Mizobata","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":12000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":11760,"hargaShift1":11760,"hargaSpare1":11760,"hargaOT1":11760,"hargaSnack1":0,"hargaShift2":11760,"hargaSpare2":11760,"hargaOT2":11760,"hargaSnack2":0,"hargaShift3":11760,"hargaSpare3":11760,"hargaOT3":11760,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"24"},{"id":"cust_025_9bfb0e","nama":"PT. Mitsui","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":20000,"biayaBox":2000,"biayaLainnya":400,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":17200,"hargaShift1":17200,"hargaSpare1":17200,"hargaOT1":17200,"hargaSnack1":0,"hargaShift2":17200,"hargaSpare2":17200,"hargaOT2":17200,"hargaSnack2":0,"hargaShift3":17200,"hargaSpare3":17200,"hargaOT3":17200,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"25"},{"id":"cust_026_591b81","nama":"PT. SRC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":18,"potonganDaging":30,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"26"},{"id":"cust_027_1f532f","nama":"PT. UTAC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18620,"hargaShift1":18620,"hargaSpare1":18620,"hargaOT1":18620,"hargaSnack1":0,"hargaShift2":18620,"hargaSpare2":18620,"hargaOT2":18620,"hargaSnack2":0,"hargaShift3":18620,"hargaSpare3":18620,"hargaOT3":18620,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"28"},{"id":"cust_028_d0da4c","nama":"PT. YOFI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18620,"hargaShift1":18620,"hargaSpare1":18620,"hargaOT1":18620,"hargaSnack1":0,"hargaShift2":18620,"hargaSpare2":18620,"hargaOT2":18620,"hargaSnack2":0,"hargaShift3":18620,"hargaSpare3":18620,"hargaOT3":18620,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"29"},{"id":"cust_029_482eea","nama":"PT. MINDA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":12500,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":12250,"hargaShift1":12250,"hargaSpare1":12250,"hargaOT1":12250,"hargaSnack1":12250,"hargaShift2":12250,"hargaSpare2":12250,"hargaOT2":12250,"hargaSnack2":12250,"hargaShift3":12250,"hargaSpare3":12250,"hargaOT3":12250,"hargaSnack3":12250,"hargaSnackBerat":0,"catatan":"","customerId":"20"},{"id":"cust_030_e9a382","nama":"PT. Murotech","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"53"},{"id":"cust_031_333c3f","nama":"PT. ATOZ","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":20000,"biayaBox":2000,"biayaLainnya":2500,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":15100,"hargaShift1":15100,"hargaSpare1":15100,"hargaOT1":15100,"hargaSnack1":2000,"hargaShift2":15100,"hargaSpare2":15100,"hargaOT2":15100,"hargaSnack2":2000,"hargaShift3":15100,"hargaSpare3":15100,"hargaOT3":15100,"hargaSnack3":2000,"hargaSnackBerat":0,"catatan":"","customerId":"55"},{"id":"cust_032_73f77f","nama":"PT. DNTI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"31"},{"id":"cust_033_ae1bde","nama":"PT. DCI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"","hargaPerPax":20000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19600,"hargaShift1":19600,"hargaSpare1":19600,"hargaOT1":19600,"hargaSnack1":0,"hargaShift2":19600,"hargaSpare2":19600,"hargaOT2":19600,"hargaSnack2":0,"hargaShift3":19600,"hargaSpare3":19600,"hargaOT3":19600,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"56"},{"id":"cust_034_59604c","nama":"PT. YKT","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14500,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14210,"hargaShift1":14210,"hargaSpare1":14210,"hargaOT1":14210,"hargaSnack1":0,"hargaShift2":14210,"hargaSpare2":14210,"hargaOT2":14210,"hargaSnack2":0,"hargaShift3":14210,"hargaSpare3":14210,"hargaOT3":14210,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"32"},{"id":"cust_035_bdee58","nama":"PT. KBI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":16000,"biayaBox":0,"biayaLainnya":2700,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":12980,"hargaShift1":12980,"hargaSpare1":12980,"hargaOT1":12980,"hargaSnack1":0,"hargaShift2":12980,"hargaSpare2":12980,"hargaOT2":12980,"hargaSnack2":0,"hargaShift3":12980,"hargaSpare3":12980,"hargaOT3":12980,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"33"},{"id":"cust_036_3470d7","nama":"RS PERMATA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":10000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":22,"potonganDaging":0,"hargaBreakfast":9800,"hargaShift1":9800,"hargaSpare1":9800,"hargaOT1":9800,"hargaSnack1":0,"hargaShift2":9800,"hargaSpare2":9800,"hargaOT2":9800,"hargaSnack2":0,"hargaShift3":9800,"hargaSpare3":9800,"hargaOT3":9800,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"59"},{"id":"cust_037_670260","nama":"PT. Shinetsu","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":450,"tempo":0,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":18,"potonganDaging":30,"hargaBreakfast":14250,"hargaShift1":14250,"hargaSpare1":14250,"hargaOT1":14250,"hargaSnack1":0,"hargaShift2":14250,"hargaSpare2":14250,"hargaOT2":14250,"hargaSnack2":0,"hargaShift3":14250,"hargaSpare3":14250,"hargaOT3":14250,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"60"},{"id":"cust_038_3123f3","nama":"PT. PKMI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":16000,"biayaBox":100,"biayaLainnya":480,"tempo":15,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":22,"potonganDaging":35,"hargaBreakfast":15100,"hargaShift1":15100,"hargaSpare1":15100,"hargaOT1":15100,"hargaSnack1":0,"hargaShift2":15100,"hargaSpare2":15100,"hargaOT2":15100,"hargaSnack2":0,"hargaShift3":15100,"hargaSpare3":15100,"hargaOT3":15100,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"34"},{"id":"cust_039_272eaf","nama":"PT. DAIKI ALMUNIUM INDUSTRI IND","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":5000,"hargaSnack2":0,"hargaShift3":5000,"hargaSpare3":5000,"hargaOT3":5000,"hargaSnack3":0,"hargaSnackBerat":5000,"catatan":"","customerId":"62"},{"id":"cust_040_c98724","nama":"PT. Etex","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13720,"hargaShift1":13720,"hargaSpare1":13720,"hargaOT1":13720,"hargaSnack1":0,"hargaShift2":13720,"hargaSpare2":13720,"hargaOT2":13720,"hargaSnack2":0,"hargaShift3":13720,"hargaSpare3":13720,"hargaOT3":13720,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"63"},{"id":"cust_041_a309cb","nama":"PT. Akashi Wahana Indonesia","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":19203,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":2,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18819,"hargaShift1":18819,"hargaSpare1":18819,"hargaOT1":18819,"hargaSnack1":0,"hargaShift2":18819,"hargaSpare2":18819,"hargaOT2":7450,"hargaSnack2":0,"hargaShift3":18819,"hargaSpare3":18819,"hargaOT3":18819,"hargaSnack3":0,"hargaSnackBerat":7450,"catatan":"","customerId":"64"},{"id":"cust_042_5e6858","nama":"PT. AWIM","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":25500,"biayaBox":2000,"biayaLainnya":3000,"tempo":15,"qtyLauk":2,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19990,"hargaShift1":19990,"hargaSpare1":19990,"hargaOT1":19990,"hargaSnack1":0,"hargaShift2":19990,"hargaSpare2":19990,"hargaOT2":7450,"hargaSnack2":0,"hargaShift3":19990,"hargaSpare3":19990,"hargaOT3":19990,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"35"},{"id":"cust_043_8af3a4","nama":"PT. POSCO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":20000,"biayaBox":0,"biayaLainnya":100,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19500,"hargaShift1":19500,"hargaSpare1":19500,"hargaOT1":19500,"hargaSnack1":0,"hargaShift2":19500,"hargaSpare2":19500,"hargaOT2":19500,"hargaSnack2":0,"hargaShift3":19500,"hargaSpare3":19500,"hargaOT3":19500,"hargaSnack3":0,"hargaSnackBerat":5000,"catatan":"","customerId":"36"},{"id":"cust_044_f70477","nama":"PT. DDMI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":120,"tempo":15,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18500,"hargaShift1":18500,"hargaSpare1":18500,"hargaOT1":18500,"hargaSnack1":0,"hargaShift2":18500,"hargaSpare2":18500,"hargaOT2":18500,"hargaSnack2":0,"hargaShift3":18500,"hargaSpare3":18500,"hargaOT3":18500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"66"},{"id":"cust_045_a4b957","nama":"PT. NBC INDONESIA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":230,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14470,"hargaShift1":14470,"hargaSpare1":14470,"hargaOT1":14470,"hargaSnack1":14470,"hargaShift2":14470,"hargaSpare2":14470,"hargaOT2":14470,"hargaSnack2":14470,"hargaShift3":14470,"hargaSpare3":14470,"hargaOT3":14470,"hargaSnack3":14470,"hargaSnackBerat":0,"catatan":"","customerId":"67"},{"id":"cust_046_5470c2","nama":"PT. DIC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":1545,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":29340,"hargaShift1":15115,"hargaSpare1":15115,"hargaOT1":13336,"hargaSnack1":0,"hargaShift2":15115,"hargaSpare2":15115,"hargaOT2":15115,"hargaSnack2":0,"hargaShift3":15115,"hargaSpare3":15115,"hargaOT3":15115,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"68"},{"id":"cust_047_3bf24c","nama":"PT. ASTRA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"69"},{"id":"cust_048_c4eb30","nama":"PT. ASKA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":200,"tempo":15,"qtyLauk":2,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":16950,"hargaShift1":16950,"hargaSpare1":16950,"hargaOT1":16950,"hargaSnack1":0,"hargaShift2":16950,"hargaSpare2":16950,"hargaOT2":16950,"hargaSnack2":0,"hargaShift3":16950,"hargaSpare3":16950,"hargaOT3":16950,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","customerId":"37"},{"id":"cust_049_0483d6","nama":"PT. RESONAC MATERIALS INDONESIA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":200,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14500,"hargaShift1":14500,"hargaSpare1":14500,"hargaOT1":14500,"hargaSnack1":0,"hargaShift2":14500,"hargaSpare2":14500,"hargaOT2":5000,"hargaSnack2":5000,"hargaShift3":14500,"hargaSpare3":14500,"hargaOT3":14500,"hargaSnack3":14500,"hargaSnackBerat":0,"catatan":"","customerId":"71"},{"id":"cust_050_sodexo","nama":"SODEXO INDONESIA","customerId":"51","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":0,"tempo":45,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":17500,"hargaShift1":17500,"hargaSpare1":17500,"hargaOT1":17500,"hargaSnack1":0,"hargaShift2":17500,"hargaSpare2":17500,"hargaOT2":17500,"hargaSnack2":0,"hargaShift3":17500,"hargaSpare3":17500,"hargaOT3":17500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","pb1":true,"pph23":false},{"id":"cust_051_ssteel","nama":"SUPER STEEL KARAWANG","customerId":"27","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":17500,"hargaShift1":17500,"hargaSpare1":17500,"hargaOT1":17500,"hargaSnack1":0,"hargaShift2":17500,"hargaSpare2":17500,"hargaOT2":17500,"hargaSnack2":0,"hargaShift3":17500,"hargaSpare3":17500,"hargaOT3":17500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":"","pb1":false,"pph23":true}];

  /* ── HELPERS ── */
  function _rp(v) {
    const n = Number(v) || 0;
    return n > 0 ? 'Rp' + n.toLocaleString('id') : '-';
  }
  function _num(v, suffix) {
    const n = Number(v) || 0;
    return n > 0 ? n + (suffix||'') : '-';
  }
  function _td(val, cls) {
    return `<td class="${cls||''}">${val}</td>`;
  }
  function _tdRp(v) {
    const n = Number(v)||0;
    return `<td class="num ${n>0?'':'text-muted'}">${n>0?'Rp'+n.toLocaleString('id'):'-'}</td>`;
  }
  function _badge(jenis) {
    const map = {
      'Rantang':'badge-info','Bento':'badge-warning',
      'Prasmanan':'badge-success','Paper Box':'badge-secondary'
    };
    return jenis ? `<span class="badge ${map[jenis]||'badge-secondary'}" style="font-size:10px">${jenis}</span>` : '-';
  }

  /* ── INIT — Supabase ── */
  async function init() {
    const page = document.getElementById('page-customer');
    if (!page) return;

    try {
      const sbData = await DB.getCustomers();
      if (sbData && sbData.length) {
        _data = sbData.map(c => {
          let cp = {};
          try {
            const raw = c.columnPrices || c.column_prices;
            cp = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
          } catch(e) {}
          return {
            ...c,
            id:             c.id || Utils.uid(),
            nama:           c.nama || c.namaPerusahaan || '',
            customerId:     c.customerId || c.customer_id || '',
            pic:            c.pic || c.pic_nama || '',
            noHp:           c.noHp || c.no_hp || c.telepon || '',
            kota:           c.kota || '',
            status:         c.status || 'AKTIF',
            alamat:         c.alamat || '',
            email:          c.email || '',
            catatan:        c.catatan || '',
            jenisPelayanan: c.jenisPelayanan || c.jenis_pelayanan || '',
            hargaPerPax:    c.hargaPerPax    || c.harga_per_pax   || 0,
            biayaBox:       c.biayaBox       || c.biaya_box       || 0,
            biayaLainnya:   c.biayaLainnya   || c.biaya_lainnya   || 0,
            tempo:          c.tempo || 0,
            qtyLauk:        c.qtyLauk        || c.qty_lauk        || 0,
            qtyPendamping:  c.qtyPendamping   || c.qty_pendamping  || 0,
            potonganAyam:   c.potonganAyam   || 0,
            potonganDaging: c.potonganDaging || 0,
            hargaBreakfast: c.hargaBreakfast  ?? cp.breakfast  ?? 0,
            hargaShift1:    c.hargaShift1     ?? c.harga_shift1 ?? cp.shift1  ?? 0,
            hargaSpare1:    c.hargaSpare1     ?? cp.spare1     ?? 0,
            hargaOT1:       c.hargaOT1        ?? c.harga_ot1   ?? cp.ot1     ?? 0,
            hargaSnack1:    c.hargaSnack1     ?? cp.snack1     ?? 0,
            hargaShift2:    c.hargaShift2     ?? cp.shift2     ?? 0,
            hargaSpare2:    c.hargaSpare2     ?? cp.spare2     ?? 0,
            hargaOT2:       c.hargaOT2        ?? cp.ot2        ?? 0,
            hargaSnack2:    c.hargaSnack2     ?? cp.snack2     ?? 0,
            hargaShift3:    c.hargaShift3     ?? cp.shift3     ?? 0,
            hargaSpare3:    c.hargaSpare3     ?? cp.spare3     ?? 0,
            hargaOT3:       c.hargaOT3        ?? cp.ot3        ?? 0,
            hargaSnack3:    c.hargaSnack3     ?? cp.snack3     ?? 0,
            hargaSnackBerat:c.hargaSnackBerat ?? cp.snakBerat  ?? 0,
            pb1:   c.pb1  ?? null,
            pph23: c.pph23 ?? null,
          };
        });
      } else {
        // Fallback localStorage / defaultData
        const saved = localStorage.getItem('becca_customers');
        _data = saved ? JSON.parse(saved) : [];
        if (!_data.length) _data = JSON.parse(JSON.stringify(_defaultData));
      }
    } catch(e) {
      console.warn('CustomerModule init error:', e);
      const saved = localStorage.getItem('becca_customers');
      _data = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(_defaultData));
    }

    // Filter out soft-deleted (trash) customers — tampilkan hanya di trash bin
    const trash = _getTrash();
    if (trash.length) {
      const trashIds = new Set(trash.map(t => String(t.id)));
      _data = _data.filter(c => !trashIds.has(String(c.id)));
    }
    // Auto-purge: hapus permanen dari DB setelah 30 hari di trash
    _autoPurgeTrash();

    // Migrate: rename old names to canonical full names
    const _RENAME_MAP = {
      'PT. NICI':           'PT. NUGRAHA INDAH CITARASA INDONESIA',
      'PT. Shinto Kogyo':   'PT. Shinto Kogyo Indonesia',
      'PT. DAIKI':          'PT. DAIKI ALMUNIUM INDUSTRI IND',
      'PT. AWI':            'PT. Akashi Wahana Indonesia',
      'PT. NBC':            'PT. NBC INDONESIA',
      'PT. RESONAC':        'PT. RESONAC MATERIALS INDONESIA',
      'PT. SSK':            'PT. Super Steel Karawang',
      'SUPER STEEL KARAWANG':'PT. Super Steel Karawang',
      'PT. AICC':           'PT. Asian Isuzu Casting Center (AICC)',
      'PT. DDMI':           'PT. Daihatsu Drivetrain Manufacturing Indonesia (DDMI)',
      'PT. IFF KRW':        'International Flavors & Fragrances (IFF)',
    };
    const _ID_MAP = {
      'PT. TSURUTA':'1','PT. FURUKAWA':'2','International Flavors & Fragrances (IFF)':'3','PT. JTEKT':'4',
      'PT. IFF OTISTA':'5','PT. GLOBAL':'6','PT. MARUGO':'7','PT. TOYOBO':'8',
      'AL-irsyad':'9','PT. DAICHINDO':'11','PT. Super Steel Karawang':'12','PT. Osin':'13',
      'PT. Dai-Ichi':'14','PT. Beta Pharmacon':'15','PT. Hiruta':'16','Pangan Bento':'17',
      'PT. ACT':'18','PT. Piston Ring':'19','PT. Softex':'21','PT. IJSC':'22',
      'PT. Toyoda Gosai':'23','PT. Mizobata':'24','PT. Mitsui':'25','PT. SRC':'26',
      'PT. UTAC':'28','PT. YOFI':'29','PT. DNTI':'31','PT. YKT':'32',
      'PT. KBI':'33','PT. PKMI':'34','PT. AWIM':'35','PT. POSCO':'36','PT. ASKA':'37',
      'PT. NUGRAHA INDAH CITARASA INDONESIA':'10','PT. Shinto Kogyo Indonesia':'30',
      'PT. DAIKI ALMUNIUM INDUSTRI IND':'62','PT. Akashi Wahana Indonesia':'64',
      'PT. NBC INDONESIA':'67','PT. RESONAC MATERIALS INDONESIA':'71',
      'PT. Daihatsu Drivetrain Manufacturing Indonesia (DDMI)':'66','SODEXO INDONESIA':'51',
      'PT. Asian Isuzu Casting Center (AICC)':'70',
      'PT. MINDA':'20','PT. Murotech':'53','PT. ATOZ':'55','PT. DCI':'56',
      'RS PERMATA':'59','PT. Shinetsu':'60','PT. Etex':'63','PT. DIC':'68','PT. ASTRA':'69',
    };
    // Canonical names (from invoices) — used to normalise casing on keep
    const _CANONICAL = {};
    Object.values(_RENAME_MAP).forEach(n => { _CANONICAL[n.trim().toLowerCase()] = n; });
    Object.keys(_ID_MAP).forEach(n => { _CANONICAL[n.trim().toLowerCase()] = n; });

    _data.forEach(c => {
      if (_RENAME_MAP[c.nama]) { c.nama = _RENAME_MAP[c.nama]; }
      // Case-insensitive canonical name normalisation
      const canon = _CANONICAL[c.nama.trim().toLowerCase()];
      if (canon) c.nama = canon;
      if (!c.customerId && _ID_MAP[c.nama]) c.customerId = _ID_MAP[c.nama];
    });
    // De-duplicate: DISPLAY only (tidak hapus dari DB)
    // Bagian (parentId terisi) tidak pernah didedup — setiap bagian adalah entitas unik
    const _seen = {};
    _data = _data.filter(c => {
      if (c.parentId) return true; // bagian selalu ditampilkan
      const key = (c.nama.trim() + '||' + (c.namaShort||'')).toLowerCase();
      if (!_seen[key]) { _seen[key] = c; return true; }
      const existing = _seen[key];
      if (!existing.customerId && c.customerId) { _seen[key] = c; return true; }
      return false;
    });

    // Migrate: set pb1/pph23 for known customers if not yet set
    const _TAX_BY_NAME = {
      'SODEXO INDONESIA':                    { pb1:true,  pph23:false },
      'PT. NUGRAHA INDAH CITARASA INDONESIA':{ pb1:true,  pph23:true  },
      'PT. Super Steel Karawang':            { pb1:false, pph23:true  },
      'PT. Shinto Kogyo Indonesia':          { pb1:false, pph23:true  },
      'PT. DAIKI ALMUNIUM INDUSTRI IND':     { pb1:true,  pph23:true  },
      'PT. RESONAC MATERIALS INDONESIA':     { pb1:true,  pph23:true  },
      'PT. NBC INDONESIA':                   { pb1:false, pph23:true  },
      'PT. Akashi Wahana Indonesia':         { pb1:false, pph23:true  },
      'PT. MINDA':   { pb1:false, pph23:true  },
      'PT. Murotech':{ pb1:false, pph23:true  },
      'PT. ATOZ':    { pb1:false, pph23:true  },
      'PT. DCI':     { pb1:false, pph23:true  },
      'RS PERMATA':  { pb1:false, pph23:true  },
      'PT. Shinetsu':{ pb1:false, pph23:true  },
      'PT. Etex':    { pb1:false, pph23:true  },
      'PT. Daihatsu Drivetrain Manufacturing Indonesia (DDMI)': { pb1:true, pph23:true },
      'PT. DIC':     { pb1:false, pph23:false },
      'PT. ASTRA':   { pb1:false, pph23:true  },
    };
    const _TAX_BY_ID = {
      '10':{ pb1:true,  pph23:true  },'20':{ pb1:false, pph23:true  },
      '27':{ pb1:false, pph23:true  },'30':{ pb1:false, pph23:true  },
      '51':{ pb1:true,  pph23:false },'53':{ pb1:false, pph23:true  },
      '55':{ pb1:false, pph23:true  },'56':{ pb1:false, pph23:true  },
      '59':{ pb1:false, pph23:true  },'60':{ pb1:false, pph23:true  },
      '62':{ pb1:true,  pph23:true  },'63':{ pb1:false, pph23:true  },
      '64':{ pb1:false, pph23:true  },'66':{ pb1:true,  pph23:true  },
      '67':{ pb1:false, pph23:true  },'68':{ pb1:false, pph23:false },
      '69':{ pb1:false, pph23:true  },'71':{ pb1:true,  pph23:true  },
    };
    let _migrated = false;
    _data.forEach(c => {
      // Fix: set pb1/pph23 independently — don't override one that's already set
      const needPb1   = c.pb1   === undefined || c.pb1   === null;
      const needPph23 = c.pph23 === undefined || c.pph23 === null;
      if (needPb1 || needPph23) {
        const tax = _TAX_BY_NAME[c.nama] || _TAX_BY_ID[String(c.customerId||'')];
        if (tax) {
          if (needPb1)   c.pb1   = tax.pb1;
          if (needPph23) c.pph23 = tax.pph23;
          _migrated = true;
        }
      }
    });

    // One-time migration: set pb1=true & pph23=true for ALL customers
    if (!localStorage.getItem('becca_tax_migration_v1')) {
      localStorage.setItem('becca_tax_migration_v1', '1');
      _data.forEach(c => { c.pb1 = true; c.pph23 = true; });
      _migrated = true;
    }

    localStorage.setItem('becca_customers', JSON.stringify(_data));
    if (_migrated) {
      _data.forEach(c => DB.saveCustomer({...c}).catch(()=>{}));
    }

    _render(page);
  }

  /* ── RENDER UTAMA ── */
  function _render(page) {
    if (!page) page = document.getElementById('page-customer');
    if (!page) return;
    const canEdit = Auth.can('customer','edit');

    const q = _search.trim();
    // Filter by tab: aktif vs arsip
    const tabData = _tab === 'arsip'
      ? _data.filter(c => (c.status||'AKTIF') === 'NON-AKTIF')
      : _data.filter(c => (c.status||'AKTIF') === 'AKTIF');
    let list = q
      ? tabData.filter(c => (c.nama||'').toLowerCase().includes(q) || (c.namaShort||'').toLowerCase().includes(q) || (c.jenisPelayanan||'').toLowerCase().includes(q) || (c.kota||'').toLowerCase().includes(q))
      : [...tabData];

    if (_sortCol) {
      list.sort((a,b) => {
        const av = a[_sortCol]||'', bv = b[_sortCol]||'';
        return typeof av === 'number'
          ? (av-bv)*_sortDir
          : String(av).localeCompare(String(bv))*_sortDir;
      });
    }

    // Group bagian under parent — inject after each parent row
    if (!_sortCol && !q) {
      const parents = list.filter(c => !c.parentId);
      const grouped = [];
      parents.forEach(p => {
        grouped.push(p);
        list.filter(b => b.parentId === p.id).forEach(b => grouped.push(b));
      });
      // Orphaned bagian (parent not in list / different tab)
      const inList = new Set(parents.map(p => p.id));
      list.filter(b => b.parentId && !inList.has(b.parentId)).forEach(b => grouped.push(b));
      list.length = 0; grouped.forEach(x => list.push(x));
    }

    const aktif = _data.filter(c=>(c.status||'AKTIF')==='AKTIF').length;
    const nonAktif = _data.length - aktif;

    page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Data Customer</h2>
        <p>Manajemen data perusahaan klien catering — ${_data.length} perusahaan</p>
      </div>
      ${canEdit ? `<div class="page-header-right">
        <button class="btn btn-ghost btn-sm" onclick="CustomerModule._bulkUpdateTax()" title="Set PB1 & PPH23 = Ada untuk semua customer"
          style="font-size:11px;color:var(--text-2)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Update PB1 & PPH
        </button>
        <button class="btn btn-ghost btn-sm" onclick="CustomerModule._bulkRecalcPrices()" title="Set semua harga shift = Harga/Pax (harga dasar)"
          style="font-size:11px;color:var(--text-2)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Recalc Harga
        </button>
        <button class="btn btn-ghost" onclick="CustomerModule.openTrash()" title="Trash">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M8 6V4h8v2"/></svg>
          Trash
        </button>
        <button class="btn btn-primary" onclick="CustomerModule.openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Customer
        </button>
      </div>` : ''}
    </div>

    <!-- TABS -->
    <div style="display:flex;gap:2px;border-bottom:2px solid var(--border);margin-bottom:var(--s4)">
      <button onclick="CustomerModule.switchTab('aktif')" style="padding:10px 18px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;margin-bottom:-2px;border-radius:6px 6px 0 0;
        ${_tab==='aktif'?'color:#10b981;border-bottom:2px solid #10b981;background:rgba(16,185,129,.08)':'color:var(--text-3);border-bottom:2px solid transparent'}">
        Customer Aktif <span style="background:rgba(16,185,129,.15);color:#10b981;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-left:6px">${aktif}</span>
      </button>
      <button onclick="CustomerModule.switchTab('arsip')" style="padding:10px 18px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;margin-bottom:-2px;border-radius:6px 6px 0 0;
        ${_tab==='arsip'?'color:#f59e0b;border-bottom:2px solid #f59e0b;background:rgba(245,158,11,.08)':'color:var(--text-3);border-bottom:2px solid transparent'}">
        Arsip <span style="background:rgba(245,158,11,.15);color:#f59e0b;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-left:6px">${nonAktif}</span>
      </button>
    </div>

    <!-- FILTER BAR -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:var(--s4)">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="position:relative;flex:1;max-width:280px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input placeholder="Cari nama / jenis / kota... (tekan Enter)" value="${_search}"
            enterkeyhint="search"
            style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
            onkeydown="if(event.key==='Enter'){event.preventDefault();CustomerModule.setSearch(this.value);}">
        </div>
        <span style="font-size:12px;color:var(--text-3);margin-left:auto">${list.length} customer ditampilkan</span>
      </div>

      <!-- TABLE SCROLL -->
      <style>
        /* Sticky columns — correct left offsets (desktop) */
        .cst-s0 { position:sticky!important; left:0px!important;  z-index:2!important; }
        .cst-s1 { position:sticky!important; left:36px!important; z-index:2!important; }
        .cst-s2 { position:sticky!important; left:88px!important; z-index:2!important;
                  box-shadow:3px 0 5px -2px rgba(0,0,0,.12); }
        /* Header rows sticky with solid bg */
        thead .cst-s0 { background:#6366f1!important; z-index:4!important; }
        thead tr:nth-child(2) .cst-s0 { background:#6366f1!important; z-index:4!important; }
        thead .cst-s1 { background:#6366f1!important; z-index:4!important; }
        thead tr:nth-child(2) .cst-s1 { background:#6366f1!important; z-index:4!important; }
        thead .cst-s2 { background:#6366f1!important; z-index:4!important; }
        thead tr:nth-child(2) .cst-s2 { background:#6366f1!important; z-index:4!important; }
        /* Body rows */
        tbody tr:nth-child(odd)  .cst-s0,
        tbody tr:nth-child(odd)  .cst-s1,
        tbody tr:nth-child(odd)  .cst-s2 { background:#ffffff!important; }
        tbody tr:nth-child(even) .cst-s0,
        tbody tr:nth-child(even) .cst-s1,
        tbody tr:nth-child(even) .cst-s2 { background:#f4f4f8!important; }
        tbody tr:hover .cst-s0,
        tbody tr:hover .cst-s1,
        tbody tr:hover .cst-s2 { background:#eef0fb!important; }
        [data-theme="dark"] tbody tr:nth-child(odd)  .cst-s0,
        [data-theme="dark"] tbody tr:nth-child(odd)  .cst-s1,
        [data-theme="dark"] tbody tr:nth-child(odd)  .cst-s2 { background:#16182a!important; }
        [data-theme="dark"] tbody tr:nth-child(even) .cst-s0,
        [data-theme="dark"] tbody tr:nth-child(even) .cst-s1,
        [data-theme="dark"] tbody tr:nth-child(even) .cst-s2 { background:#1e2030!important; }
        [data-theme="dark"] tbody tr:hover .cst-s0,
        [data-theme="dark"] tbody tr:hover .cst-s1,
        [data-theme="dark"] tbody tr:hover .cst-s2 { background:#1e2040!important; }
        /* Desktop: show full name, hide short */
        .cst-short { display:none; }
        /* Mobile: hide # and ID cols, Nama sticks at left:0, show short name */
        @media (max-width: 768px) {
          .cst-s0, .cst-s1 { display:none!important; }
          .cst-s2 { left:0px!important; box-shadow:3px 0 5px -2px rgba(0,0,0,.12); }
          .cst-full { display:none!important; }
          .cst-short { display:inline!important; }
        }
      </style>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain">
        <table style="width:100%;border-collapse:collapse;min-width:2400px;font-size:11px">

               <thead>
            <tr style="background:var(--thead-bg)">
              ${_th('#','','center','36px','cst-s0')}
              ${_th('ID','','center','52px','cst-s1')}
              ${_thS('nama','Nama Perusahaan','220px','left','cst-s2')}
              ${_thS('namaShort','Nama Singkat','100px','left')}
              ${_thS('jenisPelayanan','Jenis Pelayanan','110px','center')}
              ${_thS('hargaPerPax','Harga / Pax','90px','right')}
              ${_thS('biayaBox','Biaya Box','80px','right')}
              ${_thS('biayaLainnya','Biaya Lainnya','85px','right')}
              <th onclick="CustomerModule.sortBy('tempo')" style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${_sortCol==='tempo'?'#fbbf24':'#f97316'};white-space:nowrap;cursor:pointer;border-right:1px solid rgba(255,255,255,.08);width:75px">Tempo (hr)${_sortCol==='tempo'?(_sortDir===1?' ↑':' ↓'):''}</th>
              ${_thS('qtyLauk','Lauk','55px','center')}
              ${_thS('qtyPendamping','Pendamping','80px','center')}
              ${_thS('hargaBreakfast','Breakfast','85px','right')}
              ${_thS('hargaShift1','Shift 1','75px','right')}
              ${_thS('hargaSpare1','Spare 1','75px','right')}
              ${_thS('hargaOT1','OT 1','65px','right')}
              ${_thS('hargaSnack1','Snack 1','70px','right')}
              ${_thS('hargaShift2','Shift 2','75px','right')}
              ${_thS('hargaSpare2','Spare 2','75px','right')}
              ${_thS('hargaOT2','OT 2','65px','right')}
              ${_thS('hargaSnack2','Snack 2','70px','right')}
              ${_thS('hargaShift3','Shift 3','75px','right')}
              ${_thS('hargaSpare3','Spare 3','75px','right')}
              ${_thS('hargaOT3','OT 3','65px','right')}
              ${_thS('hargaSnack3','Snack 3','70px','right')}
              ${_thS('hargaSnackBerat','Snack Berat','85px','right')}
              ${_th('PIC','','','120px')}
              ${_th('No HP','','','110px')}
              ${_th('Kota','','','90px')}
              ${_th('Lok','','center','40px')}
              ${_thS('status','Status','75px','center')}
              ${_th('Catatan','','','160px')}
              ${_thS('pb1','PB1','65px','center')}
              ${_thS('pph23','PPH23','65px','center')}
              ${canEdit ? _th('','','center','60px') : ''}
            </tr>
          </thead>

          <tbody>
          ${!list.length ? `<tr><td colspan="33">${UI.empty({iconKey:'user', title:'Tidak ada data customer', desc:'Belum ada customer yang cocok dengan filter'})}</td></tr>` :
            list.map((c, i) => {
              const ak = (c.status||'AKTIF')==='AKTIF';
              // Solid backgrounds for sticky columns (no transparent!)
              const bg       = i%2===1 ? '#f4f4f8' : '#ffffff';
              const bgHover  = 'var(--primary-bg,rgba(99,102,241,.12))';
              // Dark mode handled via CSS var fallback
              const bgS      = `var(--surface,${bg})`;  // fallback solid
              const bgS2     = i%2===1 ? 'var(--surface2,#f4f4f8)' : 'var(--surface,#ffffff)';
              const sc = ak
                ? 'background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)'
                : 'background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.25)';
              // Sticky cell bg must be solid — use actual computed color per row
              // sticky handled by CSS .cst-s0/s1/s2
              const isBagian = !!c.parentId;
              const bagianBg = isBagian ? 'var(--surface2,#f5f5fb)' : '';
              return `<tr style="border-bottom:1px solid var(--border);background:${bagianBg};${isBagian?'border-left:3px solid rgba(99,102,241,.4)':''}"
                onmouseenter="this.style.background='var(--surface-hover,#eef0fb)'"
                onmouseleave="this.style.background='${bagianBg}'">
                <td class="cst-s0" style="padding:8px 10px;text-align:center;font-size:${isBagian?'13px':'10px'};color:${isBagian?'rgba(99,102,241,.5)':'var(--text-3)'};white-space:nowrap">${isBagian?'↳':(i+1)}</td>
                <td class="cst-s1" style="padding:4px 6px;text-align:center;white-space:nowrap">
                  <span onclick="CustomerModule.editCustomerId('${c.id}')" title="Klik untuk edit ID"
                    style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;
                      font-size:9px;font-weight:700;font-family:var(--font-mono);
                      ${c.customerId
                        ? 'background:var(--primary-bg,rgba(99,102,241,.15));color:var(--primary-h)'
                        : 'background:var(--surface2);color:var(--text-2)'};
                      padding:2px 6px;border-radius:4px;border:1px solid transparent;
                      transition:border-color .15s"
                    onmouseover="this.style.borderColor='#6366f1'"
                    onmouseout="this.style.borderColor='transparent'">
                    ${c.customerId || '–'}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </span>
                </td>
                <td class="cst-s2" style="padding:8px 12px;font-weight:700;font-size:12px;white-space:nowrap;${isBagian?'padding-left:24px;':''}">
                  <span class="cst-full">${c.nama||'-'}${isBagian&&c.namaShort?` <span style="font-size:10px;font-weight:600;color:#6366f1;background:rgba(99,102,241,.1);padding:1px 6px;border-radius:4px;margin-left:4px">${c.namaShort}</span>`:''}</span>
                  <span class="cst-short">${c.namaShort||c.nama||'-'}</span>
                </td>
                <td style="padding:8px 10px;font-size:11px;color:var(--text-2);white-space:nowrap">${c.namaShort||'-'}</td>
                <td style="padding:8px 10px;text-align:center">${_badge(c.jenisPelayanan)}</td>
                ${_tdRp(c.hargaPerPax)}
                ${_tdRp(c.biayaBox)}
                ${_tdRp(c.biayaLainnya)}
                <td class="num" style="color:#f97316;font-weight:600">${c.tempo||0}</td>
                <td class="num">${c.qtyLauk||'-'}</td>
                <td class="num">${c.qtyPendamping||'-'}</td>
                ${_tdRp(c.hargaBreakfast)}
                ${_tdRp(c.hargaShift1)}
                ${_tdRp(c.hargaSpare1)}
                ${_tdRp(c.hargaOT1)}
                ${_tdRp(c.hargaSnack1)}
                ${_tdRp(c.hargaShift2)}
                ${_tdRp(c.hargaSpare2)}
                ${_tdRp(c.hargaOT2)}
                ${_tdRp(c.hargaSnack2)}
                ${_tdRp(c.hargaShift3)}
                ${_tdRp(c.hargaSpare3)}
                ${_tdRp(c.hargaOT3)}
                ${_tdRp(c.hargaSnack3)}
                ${_tdRp(c.hargaSnackBerat)}
                <td style="padding:8px 10px;font-size:11px;color:var(--text-2)">${c.pic||'-'}</td>
                <td style="padding:8px 10px;font-size:11px;font-family:var(--font-mono);color:var(--text-2)">${c.noHp||'-'}</td>
                <td style="padding:8px 10px;font-size:11px;color:var(--text-2)">${c.kota||'-'}</td>
                <td style="padding:8px 10px;text-align:center">${c.lat&&c.lng
                  ?`<a href="https://www.google.com/maps?q=${c.lat},${c.lng}" target="_blank" title="${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:var(--success);text-decoration:none"><svg viewBox="0 0 24 24" fill="var(--success)" width="12" height="12"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></a>`
                  :`<span style="font-size:10px;color:var(--text-3)" title="Belum ada lokasi">\u2014</span>`}</td>
                <td style="padding:8px 10px;text-align:center">
                  <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;${sc}">${c.status||'AKTIF'}</span>
                </td>
                <td style="padding:8px 10px;font-size:11px;color:var(--text-3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.catatan||'-'}</td>
                <td style="padding:8px 10px;text-align:center">
                  ${c.pb1 === true  ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3)">Ada</span>`
                  : c.pb1 === false ? `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(100,116,139,.1);color:var(--text-3);border:1px solid rgba(100,116,139,.2)">Tidak Ada</span>`
                  : `<span style="font-size:10px;color:var(--text-3)">-</span>`}
                </td>
                <td style="padding:8px 10px;text-align:center">
                  ${c.pph23 === true  ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(99,102,241,.15);color:#6366f1;border:1px solid rgba(99,102,241,.3)">Ada</span>`
                  : c.pph23 === false ? `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(100,116,139,.1);color:var(--text-3);border:1px solid rgba(100,116,139,.2)">Tidak Ada</span>`
                  : `<span style="font-size:10px;color:var(--text-3)">-</span>`}
                </td>
                ${canEdit ? `<td style="padding:6px 8px;text-align:center">
                  <div style="display:flex;gap:4px;justify-content:center">
                    <button onclick="CustomerModule.openModal('${c.id}')" title="Edit"
                      style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);display:inline-flex;align-items:center;justify-content:center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button onclick="CustomerModule.deleteCustomer('${c.id}')" title="Hapus"
                      style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:transparent;cursor:pointer;color:#ef4444;display:inline-flex;align-items:center;justify-content:center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  </div>
                </td>` : ''}
              </tr>`;
            }).join('')
          }
          </tbody>
        </table>
      </div>
    </div>
    `;
    // Kalkulasi sticky offset setelah render
    _fixSticky();
  }

  /* ── TABLE HEADER HELPERS ── */
  function _thGroup(label, colspan, align, bg, cls) {
    return `<th class="${cls||''}" colspan="${colspan}" style="padding:5px 10px;text-align:${align||'left'};font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;border-right:1px solid rgba(255,255,255,.06);${bg?'background:'+bg:'background:#1e1e2e'}">${label}</th>`;
  }
  function _th(label, field, align, width, cls) {
    return `<th class="${cls||''}" style="padding:8px 10px;text-align:${align||'left'};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--thead-text);white-space:nowrap;border-right:1px solid var(--thead-border);${width?'width:'+width:''}">
      ${label}
    </th>`;
  }
  function _thS(field, label, width, align, cls) {
    const isActive = _sortCol === field;
    const arrow = isActive ? (_sortDir===1 ? ' ↑' : ' ↓') : '';
    return `<th class="${cls||''}" onclick="CustomerModule.sortBy('${field}')"
      style="padding:8px 10px;text-align:${align||'left'};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${isActive?'#fbbf24':'#fff'};white-space:nowrap;cursor:pointer;border-right:1px solid rgba(255,255,255,.08);${width?'width:'+width:''}">
      ${label}${arrow}
    </th>`;
  }

  /* ── EDIT CUSTOMER ID ── */
  function editCustomerId(custId) {
    const cust = _data.find(c => c.id === custId) || _data.find(c => String(c.id) === String(custId));
    if (!cust) return;

    const editModalId = Utils.uid();
    window._beccaEditIdModalId = editModalId;
    Modal.open({
      id: editModalId,
      title: `✏ Edit Customer ID — ${cust.nama}`,
      size: '',
      body: `
        <div style="margin-bottom:14px;font-size:11px;color:var(--text-3)">
          Customer ID digunakan untuk generate nomor invoice otomatis.
          Pastikan ID unik dan tidak sama dengan customer lain.
        </div>
        <div class="form-group">
          <label class="form-label">Customer ID <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="edit-cust-id-input"
            type="text"
            value="${cust.customerId || ''}"
            placeholder="contoh: 10, 062A, IFF3"
            style="font-family:var(--font-mono);font-size:16px;font-weight:700;letter-spacing:.05em;text-align:center"
            maxlength="10">
          <div style="font-size:10px;color:var(--text-3);margin-top:4px">
            ID saat ini: <strong>${cust.customerId || '(kosong)'}</strong>
          </div>
          <div id="edit-id-error" style="display:none;font-size:10px;color:#ef4444;margin-top:4px;font-weight:600"></div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close(window._beccaEditIdModalId)">Batal</button>
        <button class="btn btn-primary" onclick="CustomerModule._saveCustomerId('${custId}')">
          Simpan ID
        </button>`
    });
    // Focus input
    setTimeout(() => document.getElementById('edit-cust-id-input')?.focus(), 100);
  }

  function _saveCustomerId(custId) {
    const input = document.getElementById('edit-cust-id-input');
    const errEl = document.getElementById('edit-id-error');
    if (!input) return;

    const newId = input.value.trim();
    const errShow = (msg) => {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    };

    if (!newId) { errShow('ID tidak boleh kosong'); return; }

    // Cek duplikat — tidak boleh sama dengan customer lain
    const isDuplicate = _data.some(c => String(c.id) !== String(custId) && c.customerId === newId);
    if (isDuplicate) {
      const existing = _data.find(c => String(c.id) !== String(custId) && c.customerId === newId);
      errShow(`ID "${newId}" sudah digunakan oleh ${existing?.nama || 'customer lain'}`);
      return;
    }

    // Simpan ke Supabase + local
    const idx = _data.findIndex(c => c.id === custId || String(c.id) === String(custId));
    if (idx < 0) return;
    _data[idx].customerId = newId;
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    DB.saveCustomer({..._data[idx], customer_id: newId}).catch(e => console.warn('save customerId:', e));

    Modal.close(window._beccaEditIdModalId);
    Notify.success(`ID customer diperbarui: ${newId}`);
    _render();
  }

  /* ── STICKY OFFSET FIX ── */
  function _fixSticky() {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        var tbl = document.querySelector('.cst-s0');
        if (!tbl) return;
        tbl = tbl.closest('table');
        if (!tbl) return;
        // Proses tiap ROW secara terpisah — TH dan TD bisa punya lebar berbeda
        // Ukur lebar dari header row saja (satu kali) — semua body row pakai nilai sama
        var hdr = tbl.querySelector('thead tr');
        if (!hdr) return;
        var h0 = hdr.querySelector('.cst-s0');
        var h1 = hdr.querySelector('.cst-s1');
        if (!h0 || !h1) return;
        var w0 = h0.getBoundingClientRect().width;
        var w1 = h1.getBoundingClientRect().width;
        tbl.querySelectorAll('tr').forEach(function(row) {
          var c1 = row.querySelector('.cst-s1');
          var c2 = row.querySelector('.cst-s2');
          if (c1) c1.style.setProperty('left', w0+'px', 'important');
          if (c2) c2.style.setProperty('left', (w0+w1)+'px', 'important');
        });
      });
    });
  }

  /* ── CONTROLS ── */
  function switchTab(tab) { _tab = tab; _search = ''; _render(); }
  function setSearch(val) {
    _search = (val||'').toLowerCase();
    _render();
  }
  const _setSearchDebounced = Utils.debounce(v => setSearch(v), 200);
  function sortBy(col) {
    if (_sortCol === col) _sortDir *= -1; else { _sortCol = col; _sortDir = 1; }
    _render();
  }

  /* ── BAGIAN HELPERS ── */
  function _renderBagianBadge(parentId, invoiceMode) {
    const hasBagian = _data.some(b => b.parentId === parentId);
    if (!hasBagian) return '<span style="font-size:12px;color:var(--text-3)">Belum ada Bagian</span>';
    if (!invoiceMode || invoiceMode === 'single') return '';
    const color = invoiceMode === 'gabung' ? '#10b981' : '#f59e0b';
    const bg    = invoiceMode === 'gabung' ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)';
    const label = invoiceMode === 'gabung' ? 'Invoice Digabung' : 'Invoice Terpisah';
    return `<span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:var(--r-full);background:${bg};color:${color}">${label}</span>`
      + `<button class="btn btn-ghost btn-sm" style="font-size:11px;margin-left:6px" onclick="CustomerModule._openInvoiceModeAfterSave('${parentId}')">Ubah Mode</button>`;
  }

  function _renderBagianListHtml(parentId) {
    const bagian = _data.filter(b => b.parentId === parentId);
    if (!bagian.length) return '<p style="font-size:12px;color:var(--text-3);margin:0;padding:4px 0">Belum ada bagian. Klik <strong>+ Tambah Bagian</strong> untuk menambahkan.</p>';
    return bagian.map(b => {
      const pic = b.pic ? `<div style="font-size:11px;color:var(--text-3)">PIC: ${b.pic}</div>` : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:4px;background:rgba(99,102,241,.03)">`
        + `<span style="font-size:12px;font-weight:700;color:#6366f1;background:rgba(99,102,241,.1);padding:2px 10px;border-radius:var(--r-full);font-family:var(--font-mono);flex-shrink:0">${b.customerId||'–'}</span>`
        + `<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${b.namaShort||'–'}</div>${pic}</div>`
        + `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="Modal.close(window._beccaCustModalId);CustomerModule.openModal('${b.id}')">Edit</button>`
        + `</div>`;
    }).join('');
  }

  /* ── MODAL ── */
  function openModal(id, fromParentId, invoiceMode) {
    const parent = fromParentId ? (_data.find(x=>x.id===fromParentId)||null) : null;
    const c = id ? (_data.find(x=>x.id===id) || _data.find(x=>String(x.id)===String(id))) : parent ? {...parent, id:null, parentId:fromParentId, namaShort:'', customerId:_nextBagianId(parent)} : null;
    const fv = (f) => c?.[f] ?? '';
    const nv = (f) => c?.[f] ?? 0;

    const numRow = (fields) => `<div style="display:grid;grid-template-columns:${fields.map(()=>'1fr').join(' ')};gap:var(--s3)">
      ${fields.map(([field,label]) => `<div class="form-group">
        <label class="form-label">${label}</label>
        <input id="cf-${field}" type="number" min="0" class="form-control" value="${nv(field)}" style="text-align:right;font-family:var(--font-mono)">
      </div>`).join('')}
    </div>`;

    const _custModalId = Utils.uid();
    window._beccaCustModalId = _custModalId;
    Modal.open({
      id: _custModalId,
      title: c ? 'Edit Customer' : 'Tambah Customer',
      size: 'modal-xl',
      body: `
        <style>
          .modal-xl { max-width: 900px !important; }
          .cf-section { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);padding:10px 0 6px;border-top:1px solid var(--border);margin-top:4px }
        </style>

        <div class="cf-section">Info Umum</div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:var(--s3)">
          <div class="form-group">
            <label class="form-label">Nama Perusahaan <span style="color:var(--danger)">*</span></label>
            <input class="form-control" id="cf-nama" value="${fv('nama')}" placeholder="PT. ...">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Singkat</label>
            <input class="form-control" id="cf-namaShort" value="${fv('namaShort')}" placeholder="AICC, IFF, ...">
          </div>
          <div class="form-group">
            <label class="form-label">Jenis Pelayanan</label>
            <select class="form-control" id="cf-jenis">
              ${['','Rantang','Bento','Prasmanan','Paper Box'].map(j=>`<option value="${j}" ${fv('jenisPelayanan')===j?'selected':''}>${j||'— Pilih —'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="cf-status">
              <option value="AKTIF" ${(fv('status')||'AKTIF')==='AKTIF'?'selected':''}>Aktif</option>
              <option value="NON-AKTIF" ${fv('status')==='NON-AKTIF'?'selected':''}>Non-Aktif</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--s3)">
          <div class="form-group"><label class="form-label">PIC</label><input class="form-control" id="cf-pic" value="${fv('pic')}"></div>
          <div class="form-group"><label class="form-label">No. HP</label><input class="form-control" id="cf-noHp" value="${fv('noHp')}"></div>
          <div class="form-group"><label class="form-label">Kota</label><input class="form-control" id="cf-kota" value="${fv('kota')||'Karawang'}"></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="cf-email" type="email" value="${fv('email')}"></div>
        </div>
        <div class="form-group"><label class="form-label">Alamat</label><input class="form-control" id="cf-alamat" value="${fv('alamat')}"></div>

        <div class="cf-section">Lokasi (Delivery Tracking)</div>
        <div style="display:flex;gap:var(--s2);margin-bottom:var(--s3);flex-wrap:wrap">
          <button type="button" class="btn btn-ghost btn-sm" onclick="CustomerModule._useMyLocation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/></svg>
            Lokasi Saya (GPS)
          </button>
          <div style="flex:1;min-width:200px;position:relative">
            <input class="form-control" id="cf-maps-link" placeholder="Paste link Google Maps di sini..." style="font-size:12px;padding-right:60px" onpaste="setTimeout(()=>CustomerModule._parseMapLink(),50)">
            <button type="button" onclick="CustomerModule._parseMapLink()" style="position:absolute;right:2px;top:2px;bottom:2px;padding:0 10px;border:none;background:var(--primary);color:white;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">Extract</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
          <div class="form-group"><label class="form-label">Latitude</label><input class="form-control" id="cf-lat" type="number" step="any" value="${nv('lat')}" placeholder="-6.xxxxx" oninput="CustomerModule._previewLoc()"></div>
          <div class="form-group"><label class="form-label">Longitude</label><input class="form-control" id="cf-lng" type="number" step="any" value="${nv('lng')}" placeholder="107.xxxxx" oninput="CustomerModule._previewLoc()"></div>
        </div>
        <div id="cf-loc-preview" style="margin-bottom:var(--s4)">
          ${nv('lat')&&nv('lng')?`<div style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;margin-top:var(--s2)">
            <a href="https://www.google.com/maps?q=${nv('lat')},${nv('lng')}" target="_blank" style="display:block;background:var(--surface2);padding:var(--s4);text-align:center">
              <svg viewBox="0 0 24 24" fill="var(--success)" width="24" height="24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <div style="font-size:12px;color:var(--primary-h);margin-top:4px">Klik untuk buka di Google Maps</div>
            </a>
            <div style="padding:6px var(--s3);background:var(--surface2);border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:11px;color:var(--success);font-weight:600">\u2713 ${nv('lat').toFixed?nv('lat').toFixed(5):nv('lat')}, ${nv('lng').toFixed?nv('lng').toFixed(5):nv('lng')}</span>
              <a href="https://www.google.com/maps?q=${nv('lat')},${nv('lng')}" target="_blank" style="font-size:11px;color:var(--primary-h)">Buka Maps \u2197</a>
            </div>
          </div>`:'<div style="padding:var(--s3);text-align:center;color:var(--text-3);font-size:12px;border:1px dashed var(--border);border-radius:var(--r-md);margin-top:var(--s2)">Isi koordinat manual, gunakan GPS, atau paste link Google Maps</div>'}
        </div>

        <div class="cf-section">Kontrak & Tarif Dasar</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--s3)">
          <div class="form-group">
            <label class="form-label" style="color:#f97316;font-weight:700">⏱ Tempo (hari)</label>
            <input id="cf-tempo" type="number" min="0" class="form-control" value="${nv('tempo')}" style="text-align:right;font-family:var(--font-mono);border-left:3px solid #f97316">
          </div>
          <div class="form-group"><label class="form-label">Harga / Pax (Rp)</label><input id="cf-hargaPerPax" type="number" min="0" class="form-control" value="${nv('hargaPerPax')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Biaya Box (Rp)</label><input id="cf-biayaBox" type="number" min="0" class="form-control" value="${nv('biayaBox')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Biaya Lainnya (Rp)</label><input id="cf-biayaLainnya" type="number" min="0" class="form-control" value="${nv('biayaLainnya')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Qty Lauk</label><input id="cf-qtyLauk" type="number" min="0" class="form-control" value="${nv('qtyLauk')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label">Qty Pendamping</label><input id="cf-qtyPendamping" type="number" min="0" class="form-control" value="${nv('qtyPendamping')}" style="text-align:right;font-family:var(--font-mono)"></div>
        </div>

        <div style="display:flex;align-items:center;gap:10px;padding:10px 0 6px;border-top:1px solid var(--border);margin-top:4px">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Harga Per Shift (Rp)</span>
          <input id="cf-harga-base" type="number" min="0" placeholder="Harga dasar..." class="form-control" style="width:140px;text-align:right;font-family:var(--font-mono);font-size:12px;padding:3px 8px;height:28px">
          <button onclick="CustomerModule._fillAllShifts()" style="background:var(--primary);color:#fff;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;height:28px">Isi semua →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--s3)">
          <div class="form-group"><label class="form-label" style="color:var(--warning)">Breakfast</label><input class="form-control" id="cf-hargaBreakfast" type="number" min="0" value="${nv('hargaBreakfast')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#6366f1">Shift 1</label><input class="form-control" id="cf-hargaShift1" type="number" min="0" value="${nv('hargaShift1')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#6366f1">Spare 1</label><input class="form-control" id="cf-hargaSpare1" type="number" min="0" value="${nv('hargaSpare1')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#6366f1">OT 1</label><input class="form-control" id="cf-hargaOT1" type="number" min="0" value="${nv('hargaOT1')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#6366f1">Snack 1</label><input class="form-control" id="cf-hargaSnack1" type="number" min="0" value="${nv('hargaSnack1')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div></div>
          <div class="form-group"><label class="form-label" style="color:#10b981">Shift 2</label><input class="form-control" id="cf-hargaShift2" type="number" min="0" value="${nv('hargaShift2')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#10b981">Spare 2</label><input class="form-control" id="cf-hargaSpare2" type="number" min="0" value="${nv('hargaSpare2')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#10b981">OT 2</label><input class="form-control" id="cf-hargaOT2" type="number" min="0" value="${nv('hargaOT2')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#10b981">Snack 2</label><input class="form-control" id="cf-hargaSnack2" type="number" min="0" value="${nv('hargaSnack2')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div></div>
          <div class="form-group"><label class="form-label" style="color:#f59e0b">Shift 3</label><input class="form-control" id="cf-hargaShift3" type="number" min="0" value="${nv('hargaShift3')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#f59e0b">Spare 3</label><input class="form-control" id="cf-hargaSpare3" type="number" min="0" value="${nv('hargaSpare3')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#f59e0b">OT 3</label><input class="form-control" id="cf-hargaOT3" type="number" min="0" value="${nv('hargaOT3')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#f59e0b">Snack 3</label><input class="form-control" id="cf-hargaSnack3" type="number" min="0" value="${nv('hargaSnack3')}" style="text-align:right;font-family:var(--font-mono)"></div>
          <div class="form-group"><label class="form-label" style="color:#ef4444">Snack Berat</label><input class="form-control" id="cf-hargaSnackBerat" type="number" min="0" value="${nv('hargaSnackBerat')}" style="text-align:right;font-family:var(--font-mono)"></div>
        </div>

        <input type="hidden" id="cf-parentId" value="${fv('parentId')}">
        <input type="hidden" id="cf-invoiceBagian" value="${c?.invoiceBagian||''}">

        ${fv('parentId') ? `
        <div class="cf-section">Info Bagian</div>
        <div style="padding:10px 14px;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.2);border-radius:var(--r-sm);font-size:13px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>Bagian dari: <strong>${_data.find(p=>p.id===fv('parentId'))?.nama||'(induk tidak ditemukan)'}</strong></span>
          ${(() => { const p = _data.find(x=>x.id===fv('parentId')); const m = p?.invoiceBagian; return m&&m!=='single'?`<span style="font-size:11px;padding:2px 8px;border-radius:var(--r-full);font-weight:600;${m==='gabung'?'background:rgba(16,185,129,.12);color:#10b981':'background:rgba(245,158,11,.12);color:#f59e0b'}">${m==='gabung'?'Invoice Digabung':'Invoice Terpisah'}</span>`:''; })()}
        </div>` : `
        <div class="cf-section">Bagian Perusahaan</div>
        ${id ? `
        <div style="margin-bottom:var(--s2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s2)">
            <div>${_renderBagianBadge(id, c?.invoiceBagian)}</div>
            <button class="btn btn-ghost btn-sm" onclick="Modal.close(window._beccaCustModalId);CustomerModule._openBagianForm('${id}')">+ Tambah Bagian</button>
          </div>
          ${_renderBagianListHtml(id)}
        </div>` : `
        <div style="padding:10px 14px;background:var(--surface2);border-radius:var(--r-sm);font-size:12px;color:var(--text-3)">
          Tambah Bagian tersedia setelah customer disimpan pertama kali.
        </div>
        `}`}

        <div class="cf-section">Catatan</div>
        <div class="form-group">
          <input class="form-control" id="cf-catatan" value="${fv('catatan')}" placeholder="Catatan tambahan...">
        </div>

        <div class="cf-section">Pajak</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
          <div class="form-group">
            <label class="form-label" style="color:#f59e0b;font-weight:700">PB1 (10%)</label>
            <select class="form-control" id="cf-pb1">
              <option value="false" ${!c?.pb1 ? 'selected' : ''}>Tidak Ada</option>
              <option value="true"  ${c?.pb1  ? 'selected' : ''}>Ada</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="color:#6366f1;font-weight:700">PPH 23 (2%)</label>
            <select class="form-control" id="cf-pph23">
              <option value="false" ${!c?.pph23 ? 'selected' : ''}>Tidak Ada</option>
              <option value="true"  ${c?.pph23  ? 'selected' : ''}>Ada</option>
            </select>
          </div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close(window._beccaCustModalId)">Batal</button>
        <button class="btn btn-primary" onclick="CustomerModule._submit('${c?.id||''}')">
          ${c ? 'Simpan Perubahan' : 'Tambah Customer'}
        </button>`
    });
    // Clear 0 on focus, restore on blur for all number inputs in this modal
    setTimeout(() => {
      const el = document.getElementById(_custModalId);
      if (!el) return;
      el.querySelectorAll('input[type="number"]').forEach(inp => {
        inp.addEventListener('focus', () => { if (inp.value === '0') inp.value = ''; });
        inp.addEventListener('blur',  () => { if (inp.value === '')  inp.value = '0'; });
      });
      // Auto-save draft → pulih kalau modal tertutup tak sengaja (hanya untuk Tambah baru, bukan edit)
      if (!id && Utils.formDraft) Utils.formDraft.attach(el, 'customer-add');
    }, 50);
  }

  function _submit(id) {
    const g = sel => document.getElementById(sel)?.value?.trim() || '';
    const n = sel => parseFloat(document.getElementById(sel)?.value) || 0;
    const nama = g('cf-nama');
    if (!nama) { Notify.warning('Nama perusahaan wajib diisi'); return; }

    const obj = {
      id: id || Utils.uid(),
      nama, namaShort: g('cf-namaShort'),
      parentId: document.getElementById('cf-parentId')?.value || null,
      invoiceBagian: document.getElementById('cf-invoiceBagian')?.value || null,
      pic: g('cf-pic'), noHp: g('cf-noHp'), kota: g('cf-kota'),
      status: g('cf-status'), alamat: g('cf-alamat'), email: g('cf-email'),
      lat: parseFloat(document.getElementById('cf-lat')?.value)||null,
      lng: parseFloat(document.getElementById('cf-lng')?.value)||null,
      jenisPelayanan: g('cf-jenis'), catatan: g('cf-catatan'),
      hargaPerPax: n('cf-hargaPerPax'), biayaBox: n('cf-biayaBox'),
      biayaLainnya: n('cf-biayaLainnya'), tempo: n('cf-tempo'),
      qtyLauk: n('cf-qtyLauk'), qtyPendamping: n('cf-qtyPendamping'),
      hargaBreakfast: n('cf-hargaBreakfast'),
      hargaShift1: n('cf-hargaShift1'), hargaSpare1: n('cf-hargaSpare1'),
      hargaOT1: n('cf-hargaOT1'), hargaSnack1: n('cf-hargaSnack1'),
      hargaShift2: n('cf-hargaShift2'), hargaSpare2: n('cf-hargaSpare2'),
      hargaOT2: n('cf-hargaOT2'), hargaSnack2: n('cf-hargaSnack2'),
      hargaShift3: n('cf-hargaShift3'), hargaSpare3: n('cf-hargaSpare3'),
      hargaOT3: n('cf-hargaOT3'), hargaSnack3: n('cf-hargaSnack3'),
      hargaSnackBerat: n('cf-hargaSnackBerat'),
      pb1:  document.getElementById('cf-pb1')?.value === 'true',
      pph23: document.getElementById('cf-pph23')?.value === 'true',
    };

    if (id) {
      const i = _data.findIndex(c=>c.id===id || String(c.id)===String(id));
      if (i>=0) {
        Utils.mergePreserve(obj, _data[i]);
        _data[i]=obj;
      }
      else _data.push(obj);
    } else {
      _data.push(obj);
    }
    // Save ke Supabase + localStorage
    DB.saveCustomer(obj).catch(e => console.warn('saveCustomer:', e));
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    Modal.close(window._beccaCustModalId);
    Notify.success(id?'Customer diperbarui':'Customer berhasil ditambahkan');
    if (!id) Utils.formDraft?.clear('customer-add'); // hapus draft setelah sukses
    _render();
  }

  /* ── BAGIAN (PLANT/DIVISI) ── */
  function _nextBagianId(parent) {
    const suffix = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const existing = _data.filter(c => c.parentId === parent.id).length;
    return (parent.customerId || '') + (suffix[existing] || (existing+1));
  }

  function _openBagianForm(parentId) {
    const parent = _data.find(x => x.id === parentId);
    if (!parent) return;
    const newId = _nextBagianId(parent);
    const mid = 'modal-bagian-' + Date.now();
    Modal.open({
      id: mid,
      title: 'Tambah Bagian',
      body: `
        <div style="background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.18);border-radius:var(--r-sm);padding:8px 14px;margin-bottom:var(--s4);font-size:13px">
          Induk: <strong>${parent.nama}</strong>
        </div>
        <div style="display:grid;grid-template-columns:90px 1fr;gap:var(--s3);align-items:end;margin-bottom:var(--s3)">
          <div class="form-group" style="margin:0">
            <label class="form-label">ID Bagian</label>
            <input class="form-control" value="${newId}" readonly style="font-weight:700;color:#6366f1;font-family:var(--font-mono);background:rgba(99,102,241,.07);text-align:center">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Nama Singkat / Label <span style="color:var(--danger)">*</span></label>
            <input class="form-control" id="bf-namaShort" placeholder="mis. Plant A, Divisi HR, Gedung 3...">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nama Perusahaan</label>
          <input class="form-control" id="bf-nama" value="${parent.nama}">
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:var(--s3);cursor:pointer;font-size:13px;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm)">
          <input type="checkbox" id="bf-sameAsParent" onchange="CustomerModule._fillFromParent('${parentId}',this.checked)" style="width:16px;height:16px;cursor:pointer">
          <span>Sama dengan induk <span style="font-size:11px;color:var(--text-3)">(salin alamat &amp; kontak dari ${parent.namaShort||parent.nama})</span></span>
        </label>
        <div id="bf-contact-fields">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
            <div class="form-group"><label class="form-label">PIC</label><input class="form-control" id="bf-pic" value=""></div>
            <div class="form-group"><label class="form-label">No. HP</label><input class="form-control" id="bf-noHp" value=""></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
            <div class="form-group"><label class="form-label">Kota</label><input class="form-control" id="bf-kota" value=""></div>
            <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="bf-email" type="email" value=""></div>
          </div>
          <div class="form-group"><label class="form-label">Alamat</label><input class="form-control" id="bf-alamat" value=""></div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="CustomerModule._submitBagian('${parentId}','${mid}')">Simpan Bagian</button>`,
    });
    setTimeout(() => { const el = document.getElementById('bf-namaShort'); if (el) el.focus(); }, 100);
  }

  function _fillFromParent(parentId, checked) {
    const parent = _data.find(x => x.id === parentId);
    if (!parent) return;
    ['pic','noHp','kota','email','alamat'].forEach(f => {
      const el = document.getElementById('bf-' + f);
      if (!el) return;
      el.value = checked ? (parent[f] || '') : '';
      el.disabled = checked;
      el.style.opacity = checked ? '0.6' : '';
    });
  }

  async function _submitBagian(parentId, modalId) {
    const namaShort = document.getElementById('bf-namaShort')?.value?.trim() || '';
    if (!namaShort) { Notify.warning('Nama singkat bagian wajib diisi'); return; }
    const parent = _data.find(x => x.id === parentId);
    if (!parent) return;
    const isFirst = !_data.some(c => c.parentId === parentId);
    const obj = {
      id: Utils.uid(),
      customerId: _nextBagianId(parent),
      parentId,
      namaShort,
      nama: document.getElementById('bf-nama')?.value?.trim() || parent.nama,
      pic: document.getElementById('bf-pic')?.value?.trim() || '',
      noHp: document.getElementById('bf-noHp')?.value?.trim() || '',
      kota: document.getElementById('bf-kota')?.value?.trim() || '',
      email: document.getElementById('bf-email')?.value?.trim() || '',
      alamat: document.getElementById('bf-alamat')?.value?.trim() || '',
      status: parent.status || 'AKTIF',
      jenisPelayanan: parent.jenisPelayanan || '',
      hargaPerPax: parent.hargaPerPax||0, biayaBox: parent.biayaBox||0,
      biayaLainnya: parent.biayaLainnya||0, tempo: parent.tempo||0,
      qtyLauk: parent.qtyLauk||0, qtyPendamping: parent.qtyPendamping||0,
      hargaBreakfast: parent.hargaBreakfast||0,
      hargaShift1: parent.hargaShift1||0, hargaSpare1: parent.hargaSpare1||0,
      hargaOT1: parent.hargaOT1||0, hargaSnack1: parent.hargaSnack1||0,
      hargaShift2: parent.hargaShift2||0, hargaSpare2: parent.hargaSpare2||0,
      hargaOT2: parent.hargaOT2||0, hargaSnack2: parent.hargaSnack2||0,
      hargaShift3: parent.hargaShift3||0, hargaSpare3: parent.hargaSpare3||0,
      hargaOT3: parent.hargaOT3||0, hargaSnack3: parent.hargaSnack3||0,
      hargaSnackBerat: parent.hargaSnackBerat||0,
      pb1: parent.pb1||false, pph23: parent.pph23||false,
    };
    // Simpan ke memory + localStorage dulu (optimistic) lalu await DB
    _data.push(obj);
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    Modal.close(modalId);
    const saved = await DB.saveCustomer(obj);
    if (saved?._syncPending) {
      Notify.warning('Koneksi bermasalah — bagian ' + obj.customerId + ' disimpan lokal, akan sync otomatis');
    }
    if (isFirst) {
      if (!saved?._syncPending) Notify.success('Bagian ' + obj.customerId + ' tersimpan. Pilih mode invoice.');
      _openInvoiceModeAfterSave(parentId);
    } else {
      if (!saved?._syncPending) Notify.success('Bagian ' + obj.customerId + ' berhasil ditambahkan');
      _render();
      openModal(parentId);
    }
  }

  function _openInvoiceModeAfterSave(parentId) {
    const parent = _data.find(x => x.id === parentId);
    const mid = 'modal-invoice-mode-' + Date.now();
    const _card = (icon, title, desc, color, mode) =>
      '<div onclick="CustomerModule._saveInvoiceMode(\'' + parentId + '\',\'' + mode + '\',\'' + mid + '\')"'
      + ' style="cursor:pointer;display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:2px solid var(--border);border-radius:var(--r);margin-bottom:var(--s2);transition:border-color .15s,background .15s"'
      + ' onmouseenter="this.style.borderColor=\'' + color + '\';this.style.background=\'' + color + '14\'"'
      + ' onmouseleave="this.style.borderColor=\'var(--border)\';this.style.background=\'\'">'
      + '<div style="width:40px;height:40px;border-radius:var(--r-sm);background:' + color + '18;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px">' + icon + '</div>'
      + '<div><div style="font-weight:700;font-size:14px;margin-bottom:3px">' + title + '</div>'
      + '<div style="font-size:12px;color:var(--text-3)">' + desc + '</div></div></div>';
    Modal.open({
      id: mid,
      title: 'Mode Invoice Bagian',
      closable: false,
      body: '<p style="font-size:13px;color:var(--text-2);margin-bottom:var(--s4)">'
        + '<strong>' + (parent?.nama||'') + '</strong> kini memiliki Bagian.<br>'
        + 'Bagaimana invoice harus dibuat untuk perusahaan ini?</p>'
        + _card('📄','Invoice Terpisah per Bagian','Setiap Bagian mendapat invoice sendiri dengan nominal masing-masing.','#f59e0b','terpisah')
        + _card('📋','Invoice Digabung','Semua Bagian dirangkum dalam 1 invoice atas nama perusahaan induk.','#10b981','gabung'),
      footer: '',
    });
  }

  function _saveInvoiceMode(parentId, mode, modalId) {
    const parent = _data.find(x => x.id === parentId);
    if (parent) {
      parent.invoiceBagian = mode;
      DB.saveCustomer({...parent}).catch(e => console.warn('saveInvoiceMode:', e));
      localStorage.setItem('becca_customers', JSON.stringify(_data));
    }
    Modal.close(modalId);
    Notify.success('Mode invoice: ' + (mode === 'gabung' ? 'Invoice Digabung' : 'Invoice Terpisah'));
    _render();
    openModal(parentId);
  }

  function _openBagianModal(parentId) {
    _openBagianForm(parentId);
  }

  /* ── TRASH BIN SYSTEM ── */
  const _TRASH_KEY = 'becca_customers_trash';
  const _DELETED_KEY = 'becca_customers_deleted'; // legacy compat

  function _getTrash() {
    try { return JSON.parse(localStorage.getItem(_TRASH_KEY) || '[]'); } catch { return []; }
  }
  function _saveTrash(arr) { localStorage.setItem(_TRASH_KEY, JSON.stringify(arr)); }

  function _autoPurgeTrash() {
    const trash = _getTrash();
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const expired = trash.filter(t => now - new Date(t.deletedAt).getTime() > THIRTY_DAYS);
    if (expired.length) {
      expired.forEach(t => DB.deleteCustomer(t.id).catch(()=>{}));
      _saveTrash(trash.filter(t => now - new Date(t.deletedAt).getTime() <= THIRTY_DAYS));
      if(window.BECCA_DEBUG) console.log('[Customer] Auto-purged', expired.length, 'customers from trash (>30 days)');
    }
  }

  async function deleteCustomer(id) {
    const cust = _data.find(c=>c.id===id) || _data.find(c=>String(c.id)===String(id));
    if (!cust) return;
    const ok = await Modal.confirm({
      title: 'Hapus Customer',
      message: `<strong>${cust.nama}</strong> akan dipindahkan ke Trash.<br><span style="font-size:12px;color:var(--text-3)">Akan dihapus permanen setelah 30 hari, atau bisa di-restore dari Trash.</span>`,
      danger: true,
      confirmText: 'Pindahkan ke Trash',
    });
    if (!ok) return;
    // Move to trash (soft delete)
    const trash = _getTrash();
    trash.push({ id: cust.id, nama: cust.nama, deletedAt: new Date().toISOString(), data: JSON.parse(JSON.stringify(cust)) });
    _saveTrash(trash);
    // Remove from active data
    const i = _data.findIndex(c=>c.id===id || String(c.id)===String(id));
    if (i >= 0) _data.splice(i, 1);
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    Notify.success('Customer dipindahkan ke Trash');
    _render();
  }

  function openTrash() {
    const trash = _getTrash();
    const mid = 'cust-trash-'+Date.now();
    const now = Date.now();
    const THIRTY_DAYS = 30*24*60*60*1000;
    Modal.open({
      id: mid, title: '🗑 Trash (' + trash.length + ')', size: 'modal-lg',
      body: !trash.length
        ? '<div style="padding:32px;text-align:center;color:var(--text-3)">Trash kosong</div>'
        : `<div style="font-size:11px;color:var(--text-3);margin-bottom:8px">Customer di trash akan dihapus permanen setelah 30 hari.</div>
           <table class="table" style="font-size:12px"><thead><tr>
             <th>Nama</th><th style="width:120px">Dihapus</th><th style="width:100px">Sisa</th><th style="width:140px">Aksi</th>
           </tr></thead><tbody>${trash.map(t => {
             const daysLeft = Math.max(0, Math.ceil((THIRTY_DAYS - (now - new Date(t.deletedAt).getTime())) / (24*60*60*1000)));
             return `<tr>
               <td>${t.nama}</td>
               <td>${new Date(t.deletedAt).toLocaleDateString('id-ID')}</td>
               <td><span style="color:${daysLeft<7?'var(--danger)':'var(--text-3)'}">${daysLeft} hari</span></td>
               <td style="white-space:nowrap">
                 <button class="btn btn-sm btn-ghost" onclick="CustomerModule._restoreFromTrash('${t.id}','${mid}')">↩ Restore</button>
                 <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="CustomerModule._permanentDelete('${t.id}','${mid}')">✕ Hapus</button>
               </td>
             </tr>`;
           }).join('')}</tbody></table>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  async function _restoreFromTrash(id, mid) {
    const trash = _getTrash();
    const item = trash.find(t => String(t.id) === String(id));
    if (!item) return;
    // Restore data
    _data.push(item.data);
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    // Remove from trash
    _saveTrash(trash.filter(t => String(t.id) !== String(id)));
    Notify.success(item.nama + ' di-restore');
    Modal.close(mid);
    _render();
  }

  async function _permanentDelete(id, mid) {
    const ok = await Modal.confirm({
      title: 'Hapus Permanen',
      message: 'Data customer akan dihapus permanen dan tidak bisa dikembalikan.',
      danger: true, confirmText: 'Hapus Permanen',
    });
    if (!ok) return;
    const trash = _getTrash();
    _saveTrash(trash.filter(t => String(t.id) !== String(id)));
    DB.deleteCustomer(id).catch(()=>{});
    Notify.success('Customer dihapus permanen');
    Modal.close(mid);
  }

  function _fillAllShifts() {
    const base = parseFloat(document.getElementById('cf-harga-base')?.value) || 0;
    if (!base) { Notify.warning('Masukkan harga dasar terlebih dahulu'); return; }
    // Spare 1/2/3 tidak memiliki harga — tidak diisi
    const ids = ['cf-hargaBreakfast','cf-hargaShift1','cf-hargaOT1','cf-hargaSnack1',
                 'cf-hargaShift2','cf-hargaOT2','cf-hargaSnack2',
                 'cf-hargaShift3','cf-hargaOT3','cf-hargaSnack3','cf-hargaSnackBerat'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = base; });
  }

  async function _bulkRecalcPrices() {
    // Preview: semua harga shift = harga/pax
    const sample = _data.slice(0, 3).map(c => {
      const h = c.hargaPerPax ?? 0;
      return `<tr><td style="padding:4px 8px;font-size:12px">${c.nama}</td>
        <td style="padding:4px 8px;text-align:right;font-family:var(--font-mono);font-size:12px">${h.toLocaleString()}</td>
        <td style="padding:4px 8px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:700;color:#10b981">${h.toLocaleString()}</td></tr>`;
    }).join('');
    const ok = await Modal.confirm({
      title: 'Recalculate Harga Semua Customer',
      message: `<p style="font-size:13px;margin-bottom:10px">Semua harga shift = <strong>Harga/Pax (Harga Dasar)</strong><br>
        Diterapkan ke: Breakfast, Shift 1/2/3, OT, Snack, Snack Berat. <strong>Spare = 0.</strong><br>
        <em style="font-size:12px;color:var(--text-3)">Potongan PPH23, Biaya Box, Biaya Lainnya dihitung di estimasi budget Daily Order.</em></p>
        <table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:6px;overflow:hidden">
          <thead><tr style="background:var(--surface2);font-size:11px;font-weight:700">
            <th style="padding:4px 8px;text-align:left">Customer</th>
            <th style="padding:4px 8px;text-align:right">Harga/Pax</th>
            <th style="padding:4px 8px;text-align:right">= Semua Shift</th>
          </tr></thead>
          <tbody>${sample}</tbody>
        </table>
        ${_data.length > 3 ? `<p style="font-size:11px;color:var(--text-3);margin-top:6px">...dan ${_data.length - 3} customer lainnya</p>` : ''}`,
      confirmText: 'Ya, Terapkan ke Semua',
    });
    if (!ok) return;
    _data.forEach(c => {
      const h = c.hargaPerPax ?? 0;
      c.hargaBreakfast = h;
      c.hargaShift1  = h; c.hargaSpare1  = 0; c.hargaOT1    = h; c.hargaSnack1  = h;
      c.hargaShift2  = h; c.hargaSpare2  = 0; c.hargaOT2    = h; c.hargaSnack2  = h;
      c.hargaShift3  = h; c.hargaSpare3  = 0; c.hargaOT3    = h; c.hargaSnack3  = h;
      c.hargaSnackBerat = h;
    });
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    _data.forEach(c => DB.saveCustomer({...c}).catch(()=>{}));
    _render();
    Notify.success('Harga semua customer berhasil dihitung ulang ✓');
  }

  async function _bulkUpdateTax() {
    const ok = await Modal.confirm({
      title: 'Update PB1 & PPH23 Semua Customer',
      message: 'Set PB1 = <strong>Ada</strong> dan PPH23 = <strong>Ada</strong> untuk <strong>semua ' + _data.length + ' customer</strong>?',
      confirmText: 'Ya, Update Semua',
    });
    if (!ok) return;
    _data.forEach(c => { c.pb1 = true; c.pph23 = true; });
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    _data.forEach(c => DB.saveCustomer({...c}).catch(()=>{}));
    _render();
    Notify.success('PB1 & PPH23 semua customer diset Ada');
  }

  function _previewLoc() {
    const lat = parseFloat(document.getElementById('cf-lat')?.value);
    const lng = parseFloat(document.getElementById('cf-lng')?.value);
    const el = document.getElementById('cf-loc-preview');
    if (!el) return;
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      el.innerHTML = '<div style="padding:var(--s3);text-align:center;color:var(--text-3);font-size:12px;border:1px dashed var(--border);border-radius:var(--r-md);margin-top:var(--s2)">Isi Latitude & Longitude untuk melihat preview lokasi</div>';
      return;
    }
    el.innerHTML = `<div style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;margin-top:var(--s2)">
      <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="display:block">
        <img loading="lazy" decoding="async" src="https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x200&markers=color:red%7C${lat},${lng}&key=AIzaSyBhL-Y4jUxQzmHiCbSR6WWwjMcMtQK6ZmQ" style="width:100%;height:120px;object-fit:cover;display:block" onerror="this.style.display='none'">
      </a>
      <div style="padding:6px var(--s3);background:var(--surface2);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;color:var(--success);font-weight:600">\u2713 ${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="font-size:11px;color:var(--primary-h)">Buka Maps \u2197</a>
      </div>
    </div>`;
  }

  function _useMyLocation() {
    if (!navigator.geolocation) { Notify.error('Browser tidak mendukung GPS'); return; }
    Notify.info('Mengambil lokasi GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latEl = document.getElementById('cf-lat');
        const lngEl = document.getElementById('cf-lng');
        if (latEl) latEl.value = pos.coords.latitude.toFixed(6);
        if (lngEl) lngEl.value = pos.coords.longitude.toFixed(6);
        _previewLoc();
        Notify.success('Lokasi GPS berhasil diambil');
      },
      (err) => {
        if (err.code === 1) Notify.error('Akses lokasi ditolak. Izinkan di browser.');
        else Notify.error('Gagal ambil lokasi: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function _parseMapLink() {
    const input = document.getElementById('cf-maps-link');
    const url = (input?.value || '').trim();
    if (!url) { Notify.warning('Paste link Google Maps terlebih dahulu'); return; }

    // Extract coordinates from various Google Maps URL formats
    let lat, lng;
    // Format: @-6.123,107.456 or @-6.123,107.456,17z
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) { lat = parseFloat(atMatch[1]); lng = parseFloat(atMatch[2]); }
    // Format: ?q=-6.123,107.456 or &q=-6.123,107.456
    if (!lat) { const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/); if (qMatch) { lat = parseFloat(qMatch[1]); lng = parseFloat(qMatch[2]); } }
    // Format: /place/-6.123,107.456 or /dir/-6.123,107.456
    if (!lat) { const pMatch = url.match(/\/(-?\d+\.\d{3,}),(-?\d+\.\d{3,})/); if (pMatch) { lat = parseFloat(pMatch[1]); lng = parseFloat(pMatch[2]); } }
    // Format: ll=-6.123,107.456
    if (!lat) { const llMatch = url.match(/ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/); if (llMatch) { lat = parseFloat(llMatch[1]); lng = parseFloat(llMatch[2]); } }
    // Format: plain coordinates "lat,lng" pasted directly
    if (!lat) { const plain = url.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/); if (plain) { lat = parseFloat(plain[1]); lng = parseFloat(plain[2]); } }

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      Notify.error('Tidak bisa extract koordinat dari link ini. Coba paste format: -6.xxxxx, 107.xxxxx');
      return;
    }

    const latEl = document.getElementById('cf-lat');
    const lngEl = document.getElementById('cf-lng');
    if (latEl) latEl.value = lat.toFixed(6);
    if (lngEl) lngEl.value = lng.toFixed(6);
    if (input) input.value = '';
    _previewLoc();
    Notify.success(`Koordinat berhasil diambil: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }

  return { init, switchTab, setSearch, _setSearchDebounced, sortBy, openModal, _submit, _fillAllShifts, _bulkUpdateTax, _bulkRecalcPrices, _fixSticky, editCustomerId, _saveCustomerId, deleteCustomer, openTrash, _restoreFromTrash, _permanentDelete, _previewLoc, _useMyLocation, _parseMapLink, _openBagianModal, _openBagianForm, _submitBagian, _fillFromParent, _openInvoiceModeAfterSave, _saveInvoiceMode };
})();

window.CustomerModule = CustomerModule;
