/* ============================================
   BECCA V2.0 — Customer Module v4
   Fix final: background langsung di setiap td (bukan tr),
   sehingga sticky td dan non-sticky td konsisten saat hover
============================================ */

const CustomerModule = (() => {
  let _data = [];
  let _search = '';
  let _sortCol = '';
  let _sortDir = 1;

  const _defaultData = [{"id":"cust_001_701d31","nama":"PT. TSURUTA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18000,"hargaShift1":18000,"hargaSpare1":16000,"hargaOT1":0,"hargaSnack1":0,"hargaShift2":18000,"hargaSpare2":18000,"hargaOT2":19000,"hargaSnack2":0,"hargaShift3":19000,"hargaSpare3":0,"hargaOT3":0,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_002_0a3ffd","nama":"PT. FURUKAWA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":15000,"biayaBox":2000,"biayaLainnya":0,"tempo":45,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":12700,"hargaShift1":12700,"hargaSpare1":13000,"hargaOT1":13000,"hargaSnack1":5000,"hargaShift2":13000,"hargaSpare2":13000,"hargaOT2":13000,"hargaSnack2":5000,"hargaShift3":13000,"hargaSpare3":13000,"hargaOT3":13000,"hargaSnack3":5000,"hargaSnackBerat":0,"catatan":""},{"id":"cust_003_764755","nama":"PT. IFF KRW","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":27000,"biayaBox":0,"biayaLainnya":5000,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":13,"potonganDaging":25,"hargaBreakfast":21460,"hargaShift1":21460,"hargaSpare1":21460,"hargaOT1":21460,"hargaSnack1":6500,"hargaShift2":21460,"hargaSpare2":6500,"hargaOT2":33500,"hargaSnack2":6500,"hargaShift3":33500,"hargaSpare3":6500,"hargaOT3":33500,"hargaSnack3":6500,"hargaSnackBerat":33500,"catatan":""},{"id":"cust_004_3ca91b","nama":"PT. JTEKT","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":16500,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":15,"potonganDaging":30,"hargaBreakfast":5000,"hargaShift1":14210,"hargaSpare1":14210,"hargaOT1":14210,"hargaSnack1":9000,"hargaShift2":14210,"hargaSpare2":14210,"hargaOT2":14210,"hargaSnack2":9000,"hargaShift3":14210,"hargaSpare3":14210,"hargaOT3":14210,"hargaSnack3":9000,"hargaSnackBerat":0,"catatan":""},{"id":"cust_005_aaea7e","nama":"PT. IFF OTISTA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Paper Box","hargaPerPax":25000,"biayaBox":2000,"biayaLainnya":5000,"tempo":60,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":13,"potonganDaging":25,"hargaBreakfast":17500,"hargaShift1":17500,"hargaSpare1":17500,"hargaOT1":17500,"hargaSnack1":0,"hargaShift2":17500,"hargaSpare2":17500,"hargaOT2":17500,"hargaSnack2":0,"hargaShift3":17500,"hargaSpare3":17500,"hargaOT3":17500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_006_289626","nama":"PT. GLOBAL","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13720,"hargaShift1":13720,"hargaSpare1":13720,"hargaOT1":13720,"hargaSnack1":0,"hargaShift2":13720,"hargaSpare2":13720,"hargaOT2":13720,"hargaSnack2":0,"hargaShift3":13720,"hargaSpare3":13720,"hargaOT3":13720,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_007_f6ccb0","nama":"PT. MARUGO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":13000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":18,"potonganDaging":35,"hargaBreakfast":12740,"hargaShift1":12740,"hargaSpare1":12740,"hargaOT1":12740,"hargaSnack1":0,"hargaShift2":12740,"hargaSpare2":12740,"hargaOT2":12740,"hargaSnack2":0,"hargaShift3":12740,"hargaSpare3":12740,"hargaOT3":12740,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_008_baad0c","nama":"PT. TOYOBO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":10500,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":10290,"hargaShift1":10290,"hargaSpare1":10290,"hargaOT1":10290,"hargaSnack1":0,"hargaShift2":10290,"hargaSpare2":10290,"hargaOT2":10290,"hargaSnack2":0,"hargaShift3":10290,"hargaSpare3":10290,"hargaOT3":10290,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_009_f8f0e2","nama":"PT. NICI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":1000,"tempo":60,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":15,"potonganDaging":30,"hargaBreakfast":16150,"hargaShift1":16150,"hargaSpare1":16150,"hargaOT1":16150,"hargaSnack1":0,"hargaShift2":16150,"hargaSpare2":16150,"hargaOT2":7000,"hargaSnack2":0,"hargaShift3":7000,"hargaSpare3":7000,"hargaOT3":7000,"hargaSnack3":0,"hargaSnackBerat":7000,"catatan":""},{"id":"cust_010_3b221d","nama":"AL-irsyad","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13720,"hargaShift1":13720,"hargaSpare1":13720,"hargaOT1":13720,"hargaSnack1":0,"hargaShift2":13720,"hargaSpare2":13720,"hargaOT2":13720,"hargaSnack2":0,"hargaShift3":13720,"hargaSpare3":13720,"hargaOT3":13720,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_011_6e1374","nama":"PT. DAICHINDO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":17150,"hargaShift1":17150,"hargaSpare1":17150,"hargaOT1":17150,"hargaSnack1":0,"hargaShift2":17150,"hargaSpare2":17150,"hargaOT2":17150,"hargaSnack2":0,"hargaShift3":17150,"hargaSpare3":17150,"hargaOT3":17150,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_012_7bead7","nama":"PT. SSK","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":2,"qtyPendamping":2,"potonganAyam":18,"potonganDaging":35,"hargaBreakfast":16660,"hargaShift1":16660,"hargaSpare1":16660,"hargaOT1":16660,"hargaSnack1":0,"hargaShift2":16660,"hargaSpare2":16660,"hargaOT2":10000,"hargaSnack2":0,"hargaShift3":16660,"hargaSpare3":16660,"hargaOT3":16660,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_013_f86d31","nama":"PT. Shinto Kogyo","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":15,"potonganDaging":30,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":5000,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_014_b03d4a","nama":"PT. Osin","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_015_59b0d7","nama":"PT. Dai-Ichi","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":16660,"hargaShift1":16660,"hargaSpare1":16660,"hargaOT1":16660,"hargaSnack1":0,"hargaShift2":16660,"hargaSpare2":16660,"hargaOT2":16660,"hargaSnack2":0,"hargaShift3":16660,"hargaSpare3":16660,"hargaOT3":16660,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_016_ee594c","nama":"PT. Beta Pharmacon","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":16000,"biayaBox":1500,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14180,"hargaShift1":14180,"hargaSpare1":14180,"hargaOT1":14180,"hargaSnack1":0,"hargaShift2":14180,"hargaSpare2":14180,"hargaOT2":14180,"hargaSnack2":0,"hargaShift3":14180,"hargaSpare3":14180,"hargaOT3":14180,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_017_0c65ef","nama":"PT. Hiruta","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":2000,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14660,"hargaShift1":14660,"hargaSpare1":14660,"hargaOT1":14660,"hargaSnack1":0,"hargaShift2":14660,"hargaSpare2":14660,"hargaOT2":14660,"hargaSnack2":0,"hargaShift3":14660,"hargaSpare3":14660,"hargaOT3":14660,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_018_799c4c","nama":"Pangan Bento","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":20000,"biayaBox":0,"biayaLainnya":0,"tempo":0,"qtyLauk":0,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19600,"hargaShift1":19600,"hargaSpare1":19600,"hargaOT1":19600,"hargaSnack1":0,"hargaShift2":19600,"hargaSpare2":19600,"hargaOT2":19600,"hargaSnack2":0,"hargaShift3":19600,"hargaSpare3":19600,"hargaOT3":19600,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_019_6b840a","nama":"PT. ACT","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_020_776c31","nama":"PT. Piston Ring","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_021_e3cdf3","nama":"PT. Softex","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":13500,"biayaBox":0,"biayaLainnya":0,"tempo":45,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13230,"hargaShift1":13230,"hargaSpare1":13230,"hargaOT1":13230,"hargaSnack1":0,"hargaShift2":13230,"hargaSpare2":13230,"hargaOT2":13230,"hargaSnack2":0,"hargaShift3":13230,"hargaSpare3":13230,"hargaOT3":13230,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_022_c336d3","nama":"PT. IJSC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Paper Box","hargaPerPax":25000,"biayaBox":2000,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":22500,"hargaShift1":22500,"hargaSpare1":22500,"hargaOT1":22500,"hargaSnack1":0,"hargaShift2":22500,"hargaSpare2":22500,"hargaOT2":22500,"hargaSnack2":0,"hargaShift3":22500,"hargaSpare3":22500,"hargaOT3":22500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_023_1f506f","nama":"PT. Toyoda Gosai","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":12000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":11760,"hargaShift1":11760,"hargaSpare1":11760,"hargaOT1":11760,"hargaSnack1":0,"hargaShift2":11760,"hargaSpare2":11760,"hargaOT2":11760,"hargaSnack2":0,"hargaShift3":11760,"hargaSpare3":11760,"hargaOT3":11760,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_024_912b65","nama":"PT. Mizobata","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":12000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":11760,"hargaShift1":11760,"hargaSpare1":11760,"hargaOT1":11760,"hargaSnack1":0,"hargaShift2":11760,"hargaSpare2":11760,"hargaOT2":11760,"hargaSnack2":0,"hargaShift3":11760,"hargaSpare3":11760,"hargaOT3":11760,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_025_9bfb0e","nama":"PT. Mitsui","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":20000,"biayaBox":2000,"biayaLainnya":400,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":17200,"hargaShift1":17200,"hargaSpare1":17200,"hargaOT1":17200,"hargaSnack1":0,"hargaShift2":17200,"hargaSpare2":17200,"hargaOT2":17200,"hargaSnack2":0,"hargaShift3":17200,"hargaSpare3":17200,"hargaOT3":17200,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_026_591b81","nama":"PT. SRC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":18,"potonganDaging":30,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_027_1f532f","nama":"PT. UTAC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18620,"hargaShift1":18620,"hargaSpare1":18620,"hargaOT1":18620,"hargaSnack1":0,"hargaShift2":18620,"hargaSpare2":18620,"hargaOT2":18620,"hargaSnack2":0,"hargaShift3":18620,"hargaSpare3":18620,"hargaOT3":18620,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_028_d0da4c","nama":"PT. YOFI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18620,"hargaShift1":18620,"hargaSpare1":18620,"hargaOT1":18620,"hargaSnack1":0,"hargaShift2":18620,"hargaSpare2":18620,"hargaOT2":18620,"hargaSnack2":0,"hargaShift3":18620,"hargaSpare3":18620,"hargaOT3":18620,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_029_482eea","nama":"PT. MINDA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":12500,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":12250,"hargaShift1":12250,"hargaSpare1":12250,"hargaOT1":12250,"hargaSnack1":12250,"hargaShift2":12250,"hargaSpare2":12250,"hargaOT2":12250,"hargaSnack2":12250,"hargaShift3":12250,"hargaSpare3":12250,"hargaOT3":12250,"hargaSnack3":12250,"hargaSnackBerat":0,"catatan":""},{"id":"cust_030_e9a382","nama":"PT. Murotech","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_031_333c3f","nama":"PT. ATOZ","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":20000,"biayaBox":2000,"biayaLainnya":2500,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":15100,"hargaShift1":15100,"hargaSpare1":15100,"hargaOT1":15100,"hargaSnack1":2000,"hargaShift2":15100,"hargaSpare2":15100,"hargaOT2":15100,"hargaSnack2":2000,"hargaShift3":15100,"hargaSpare3":15100,"hargaOT3":15100,"hargaSnack3":2000,"hargaSnackBerat":0,"catatan":""},{"id":"cust_032_73f77f","nama":"PT. DNTI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Bento","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_033_ae1bde","nama":"PT. DCI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"","hargaPerPax":20000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19600,"hargaShift1":19600,"hargaSpare1":19600,"hargaOT1":19600,"hargaSnack1":0,"hargaShift2":19600,"hargaSpare2":19600,"hargaOT2":19600,"hargaSnack2":0,"hargaShift3":19600,"hargaSpare3":19600,"hargaOT3":19600,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_034_59604c","nama":"PT. YKT","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14500,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14210,"hargaShift1":14210,"hargaSpare1":14210,"hargaOT1":14210,"hargaSnack1":0,"hargaShift2":14210,"hargaSpare2":14210,"hargaOT2":14210,"hargaSnack2":0,"hargaShift3":14210,"hargaSpare3":14210,"hargaOT3":14210,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_035_bdee58","nama":"PT. KBI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":16000,"biayaBox":0,"biayaLainnya":2700,"tempo":30,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":12980,"hargaShift1":12980,"hargaSpare1":12980,"hargaOT1":12980,"hargaSnack1":0,"hargaShift2":12980,"hargaSpare2":12980,"hargaOT2":12980,"hargaSnack2":0,"hargaShift3":12980,"hargaSpare3":12980,"hargaOT3":12980,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_036_3470d7","nama":"RS PERMATA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":10000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":22,"potonganDaging":0,"hargaBreakfast":9800,"hargaShift1":9800,"hargaSpare1":9800,"hargaOT1":9800,"hargaSnack1":0,"hargaShift2":9800,"hargaSpare2":9800,"hargaOT2":9800,"hargaSnack2":0,"hargaShift3":9800,"hargaSpare3":9800,"hargaOT3":9800,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_037_670260","nama":"PT. Shinetsu","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":450,"tempo":0,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":18,"potonganDaging":30,"hargaBreakfast":14250,"hargaShift1":14250,"hargaSpare1":14250,"hargaOT1":14250,"hargaSnack1":0,"hargaShift2":14250,"hargaSpare2":14250,"hargaOT2":14250,"hargaSnack2":0,"hargaShift3":14250,"hargaSpare3":14250,"hargaOT3":14250,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_038_3123f3","nama":"PT. PKMI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":16000,"biayaBox":100,"biayaLainnya":480,"tempo":15,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":22,"potonganDaging":35,"hargaBreakfast":15100,"hargaShift1":15100,"hargaSpare1":15100,"hargaOT1":15100,"hargaSnack1":0,"hargaShift2":15100,"hargaSpare2":15100,"hargaOT2":15100,"hargaSnack2":0,"hargaShift3":15100,"hargaSpare3":15100,"hargaOT3":15100,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_039_272eaf","nama":"PT. DAIKI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":5000,"hargaSnack2":0,"hargaShift3":5000,"hargaSpare3":5000,"hargaOT3":5000,"hargaSnack3":0,"hargaSnackBerat":5000,"catatan":""},{"id":"cust_040_c98724","nama":"PT. Etex","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":14000,"biayaBox":0,"biayaLainnya":0,"tempo":30,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":13720,"hargaShift1":13720,"hargaSpare1":13720,"hargaOT1":13720,"hargaSnack1":0,"hargaShift2":13720,"hargaSpare2":13720,"hargaOT2":13720,"hargaSnack2":0,"hargaShift3":13720,"hargaSpare3":13720,"hargaOT3":13720,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_041_a309cb","nama":"PT. AWI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":19203,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":2,"qtyPendamping":0,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18819,"hargaShift1":18819,"hargaSpare1":18819,"hargaOT1":18819,"hargaSnack1":0,"hargaShift2":18819,"hargaSpare2":18819,"hargaOT2":7450,"hargaSnack2":0,"hargaShift3":18819,"hargaSpare3":18819,"hargaOT3":18819,"hargaSnack3":0,"hargaSnackBerat":7450,"catatan":""},{"id":"cust_042_5e6858","nama":"PT. AWIM","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":25500,"biayaBox":2000,"biayaLainnya":3000,"tempo":15,"qtyLauk":2,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19990,"hargaShift1":19990,"hargaSpare1":19990,"hargaOT1":19990,"hargaSnack1":0,"hargaShift2":19990,"hargaSpare2":19990,"hargaOT2":7450,"hargaSnack2":0,"hargaShift3":19990,"hargaSpare3":19990,"hargaOT3":19990,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_043_8af3a4","nama":"PT. POSCO","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":20000,"biayaBox":0,"biayaLainnya":100,"tempo":30,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":19500,"hargaShift1":19500,"hargaSpare1":19500,"hargaOT1":19500,"hargaSnack1":0,"hargaShift2":19500,"hargaSpare2":19500,"hargaOT2":19500,"hargaSnack2":0,"hargaShift3":19500,"hargaSpare3":19500,"hargaOT3":19500,"hargaSnack3":0,"hargaSnackBerat":5000,"catatan":""},{"id":"cust_044_f70477","nama":"PT. DDMI","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":19000,"biayaBox":0,"biayaLainnya":120,"tempo":15,"qtyLauk":2,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":18500,"hargaShift1":18500,"hargaSpare1":18500,"hargaOT1":18500,"hargaSnack1":0,"hargaShift2":18500,"hargaSpare2":18500,"hargaOT2":18500,"hargaSnack2":0,"hargaShift3":18500,"hargaSpare3":18500,"hargaOT3":18500,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_045_a4b957","nama":"PT. NBC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":230,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14470,"hargaShift1":14470,"hargaSpare1":14470,"hargaOT1":14470,"hargaSnack1":14470,"hargaShift2":14470,"hargaSpare2":14470,"hargaOT2":14470,"hargaSnack2":14470,"hargaShift3":14470,"hargaSpare3":14470,"hargaOT3":14470,"hargaSnack3":14470,"hargaSnackBerat":0,"catatan":""},{"id":"cust_046_5470c2","nama":"PT. DIC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":17000,"biayaBox":0,"biayaLainnya":1545,"tempo":15,"qtyLauk":1,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":29340,"hargaShift1":15115,"hargaSpare1":15115,"hargaOT1":13336,"hargaSnack1":0,"hargaShift2":15115,"hargaSpare2":15115,"hargaOT2":15115,"hargaSnack2":0,"hargaShift3":15115,"hargaSpare3":15115,"hargaOT3":15115,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_047_3bf24c","nama":"PT. ASTRA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Prasmanan","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":0,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14700,"hargaShift1":14700,"hargaSpare1":14700,"hargaOT1":14700,"hargaSnack1":0,"hargaShift2":14700,"hargaSpare2":14700,"hargaOT2":14700,"hargaSnack2":0,"hargaShift3":14700,"hargaSpare3":14700,"hargaOT3":14700,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_048_c4eb30","nama":"PT. ASKA","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":17500,"biayaBox":0,"biayaLainnya":200,"tempo":15,"qtyLauk":2,"qtyPendamping":2,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":16950,"hargaShift1":16950,"hargaSpare1":16950,"hargaOT1":16950,"hargaSnack1":0,"hargaShift2":16950,"hargaSpare2":16950,"hargaOT2":16950,"hargaSnack2":0,"hargaShift3":16950,"hargaSpare3":16950,"hargaOT3":16950,"hargaSnack3":0,"hargaSnackBerat":0,"catatan":""},{"id":"cust_049_0483d6","nama":"PT. RESONAC","pic":"","noHp":"","kota":"Karawang","status":"AKTIF","alamat":"","email":"","jenisPelayanan":"Rantang","hargaPerPax":15000,"biayaBox":0,"biayaLainnya":200,"tempo":15,"qtyLauk":1,"qtyPendamping":1,"potonganAyam":0,"potonganDaging":0,"hargaBreakfast":14500,"hargaShift1":14500,"hargaSpare1":14500,"hargaOT1":14500,"hargaSnack1":0,"hargaShift2":14500,"hargaSpare2":14500,"hargaOT2":5000,"hargaSnack2":5000,"hargaShift3":14500,"hargaSpare3":14500,"hargaOT3":14500,"hargaSnack3":14500,"hargaSnackBerat":0,"catatan":""}];

  /* Warna row: computed dari CSS vars saat pertama kali render.
     Diambil dari getComputedStyle supaya support dark/light mode */
  const BG_HOV = 'rgba(99,102,241,.08)';
  const BG_ODD  = 'var(--surface)';
  const BG_EVEN = 'var(--surface2)';

  function _tdRp(v, bg) {
    const n = Number(v)||0;
    return `<td class="num ${n>0?'':'text-muted'}" style="background:${bg}">${n>0?'Rp'+n.toLocaleString('id'):'-'}</td>`;
  }
  function _badge(jenis) {
    const map = {'Rantang':'badge-info','Bento':'badge-warning','Prasmanan':'badge-success','Paper Box':'badge-secondary'};
    return jenis ? `<span class="badge ${map[jenis]||'badge-secondary'}" style="font-size:10px">${jenis}</span>` : '-';
  }

  async function init() {
    const page = document.getElementById('page-customer');
    if (!page) return;
    try {
      const saved = localStorage.getItem('becca_customers');
      _data = saved ? JSON.parse(saved) : [];
      if (!_data.length) {
        _data = JSON.parse(JSON.stringify(_defaultData));
        localStorage.setItem('becca_customers', JSON.stringify(_data));
      }
    } catch(e) {
      _data = JSON.parse(JSON.stringify(_defaultData));
    }
    _renderFull(page);
  }

  function _renderFull(page) {
    if (!page) page = document.getElementById('page-customer');
    if (!page) return;
    const canEdit = Auth.can('customer','edit');
    const aktif = _data.filter(c=>(c.status||'AKTIF')==='AKTIF').length;

    page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Data Customer</h2>
        <p>Manajemen data perusahaan klien catering</p>
      </div>
      ${canEdit ? `<div class="page-header-right">
        <button class="btn btn-primary" onclick="CustomerModule.openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Customer
        </button>
      </div>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s4)">
      ${[
        {l:'Total Customer',v:_data.length,c:'#6366f1',s:'perusahaan'},
        {l:'Aktif',v:aktif,c:'#10b981',s:'aktif'},
        {l:'Tidak Aktif',v:_data.length-aktif,c:'#f59e0b',s:'non-aktif'},
      ].map(s=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${s.c}"></div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px">${s.l}</div>
        <div style="font-size:22px;font-weight:900;color:${s.c};font-family:var(--font-mono)">${s.v} <span style="font-size:12px;font-weight:400;color:var(--text-3)">${s.s}</span></div>
      </div>`).join('')}
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="position:relative;flex:1;max-width:280px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input id="cust-search-input" placeholder="Cari nama / jenis / kota..." value="${_search}"
            style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
            oninput="CustomerModule.setSearch(this.value)">
        </div>
        <span id="cust-count-label" style="font-size:12px;color:var(--text-3);margin-left:auto">${_data.length} customer</span>
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <style>
          /* Sticky 2 kolom kiri — background diset LANGSUNG di td via inline style
             sehingga tidak ada konflik CSS specificity apapun */
          #cust-table td.s-no, #cust-table th.s-no {
            position:sticky; left:0; z-index:3; width:40px; min-width:40px;
          }
          #cust-table td.s-nama, #cust-table th.s-nama {
            position:sticky; left:40px; z-index:3; width:220px; min-width:220px;
            border-right:2px solid var(--border2) !important;
            box-shadow:4px 0 8px -2px rgba(0,0,0,.35);
          }
          #cust-table thead th { position:sticky; top:0; z-index:4; }
          #cust-table thead tr:first-child th { top:0; background:#1e1e2e !important; }
          #cust-table thead tr:nth-child(2) th { top:28px; background:var(--primary-h) !important; }
          #cust-table thead th.s-no, #cust-table thead th.s-nama { z-index:6 !important; }
        </style>
        <table id="cust-table" style="width:100%;border-collapse:collapse;min-width:2400px;font-size:11px">
          <thead>
            <tr>
              <th class="s-no s-nama" colspan="2" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;border-right:none"></th>
              <th colspan="1" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#1e1e2e">JENIS</th>
              <th colspan="8" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#2a1f4a">KONTRAK & HARGA</th>
              <th colspan="5" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#1a2f1a">HARGA SHIFT 1</th>
              <th colspan="4" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#2f1a1a">HARGA SHIFT 2</th>
              <th colspan="4" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#1a2a2f">HARGA SHIFT 3</th>
              <th colspan="1" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#2f2a1a">SNACK BERAT</th>
              <th colspan="3" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#1e1e2e">PIC & KONTAK</th>
              <th colspan="1" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:center;background:#1e1e2e">STATUS</th>
              <th colspan="1" style="padding:5px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;background:#1e1e2e">CATATAN</th>
              ${canEdit ? '<th colspan="1" style="padding:5px 10px;background:#1e1e2e"></th>' : ''}
            </tr>
            <tr>
              <th class="s-no"   style="padding:8px 6px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;border-right:none">#</th>
              <th class="s-nama" style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff">Nama Perusahaan</th>
              ${_thS('jenisPelayanan','Jenis Pelayanan','110px','center')}
              ${_thS('hargaPerPax','Harga / Pax','90px','right')}
              ${_thS('biayaBox','Biaya Box','80px','right')}
              ${_thS('biayaLainnya','Biaya Lainnya','85px','right')}
              ${_thS('tempo','Tempo (hr)','70px','right')}
              ${_thS('potonganAyam','Ayam (kg)','70px','right')}
              ${_thS('potonganDaging','Daging (kg)','75px','right')}
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
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap;width:120px">PIC</th>
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap;width:110px">No HP</th>
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap;width:90px">Kota</th>
              ${_thS('status','Status','75px','center')}
              <th style="padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap;width:160px">Catatan</th>
              ${canEdit ? '<th style="padding:8px 10px;width:60px"></th>' : ''}
            </tr>
          </thead>
          <tbody id="cust-tbody"></tbody>
        </table>
      </div>
    </div>`;

    _renderTbody(canEdit);
  }

  function _renderTbody(canEdit) {
    if (canEdit === undefined) canEdit = Auth.can('customer','edit');

    let list = _search
      ? _data.filter(c =>
          (c.nama||'').toLowerCase().includes(_search) ||
          (c.jenisPelayanan||'').toLowerCase().includes(_search) ||
          (c.kota||'').toLowerCase().includes(_search))
      : [..._data];

    if (_sortCol) {
      list.sort((a,b) => {
        const av = a[_sortCol]||'', bv = b[_sortCol]||'';
        return typeof av === 'number' ? (av-bv)*_sortDir : String(av).localeCompare(String(bv))*_sortDir;
      });
    }

    const countEl = document.getElementById('cust-count-label');
    if (countEl) countEl.textContent = list.length + ' customer';

    const tbody = document.getElementById('cust-tbody');
    if (!tbody) { _renderFull(); return; }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="30" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data customer.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((c, i) => {
      /* KUNCI FIX: background diset LANGSUNG di setiap td via inline style.
         Tidak ada background di tr sama sekali.
         Hover update semua td sekaligus via JS — tidak ada CSS yang bisa override. */
      const bg = i % 2 === 0 ? BG_ODD : BG_EVEN;
      const ak = (c.status||'AKTIF') === 'AKTIF';
      const sc = ak
        ? 'background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)'
        : 'background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.25)';

      return `<tr
        onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='rgba(99,102,241,.08)'})"
        onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"
        style="border-bottom:1px solid var(--border)">
        <td class="s-no"   style="padding:8px 6px;text-align:center;font-size:10px;color:var(--text-3);border-right:none;background:${bg}">${i+1}</td>
        <td class="s-nama" style="padding:8px 12px;font-weight:700;font-size:12px;white-space:nowrap;background:${bg}">${c.nama||'-'}</td>
        <td style="padding:8px 10px;text-align:center;background:${bg}">${_badge(c.jenisPelayanan)}</td>
        ${_tdRp(c.hargaPerPax,bg)}
        ${_tdRp(c.biayaBox,bg)}
        ${_tdRp(c.biayaLainnya,bg)}
        <td class="num" style="background:${bg}">${c.tempo||0}</td>
        <td class="num ${(c.potonganAyam||0)>0?'':'text-muted'}" style="background:${bg}">${c.potonganAyam||'-'}</td>
        <td class="num ${(c.potonganDaging||0)>0?'':'text-muted'}" style="background:${bg}">${c.potonganDaging||'-'}</td>
        <td class="num" style="background:${bg}">${c.qtyLauk||'-'}</td>
        <td class="num" style="background:${bg}">${c.qtyPendamping||'-'}</td>
        ${_tdRp(c.hargaBreakfast,bg)}
        ${_tdRp(c.hargaShift1,bg)}
        ${_tdRp(c.hargaSpare1,bg)}
        ${_tdRp(c.hargaOT1,bg)}
        ${_tdRp(c.hargaSnack1,bg)}
        ${_tdRp(c.hargaShift2,bg)}
        ${_tdRp(c.hargaSpare2,bg)}
        ${_tdRp(c.hargaOT2,bg)}
        ${_tdRp(c.hargaSnack2,bg)}
        ${_tdRp(c.hargaShift3,bg)}
        ${_tdRp(c.hargaSpare3,bg)}
        ${_tdRp(c.hargaOT3,bg)}
        ${_tdRp(c.hargaSnack3,bg)}
        ${_tdRp(c.hargaSnackBerat,bg)}
        <td style="padding:8px 10px;font-size:11px;color:var(--text-2);background:${bg}">${c.pic||'-'}</td>
        <td style="padding:8px 10px;font-size:11px;font-family:var(--font-mono);color:var(--text-2);background:${bg}">${c.noHp||'-'}</td>
        <td style="padding:8px 10px;font-size:11px;color:var(--text-2);background:${bg}">${c.kota||'-'}</td>
        <td style="padding:8px 10px;text-align:center;background:${bg}"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;${sc}">${c.status||'AKTIF'}</span></td>
        <td style="padding:8px 10px;font-size:11px;color:var(--text-3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:${bg}">${c.catatan||'-'}</td>
        ${canEdit ? `<td style="padding:6px 8px;text-align:center;background:${bg}">
          <button onclick="CustomerModule.openModal('${c.id}')"
            style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);display:inline-flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
          </button>
        </td>` : ''}
      </tr>`;
    }).join('');
  }

  function _thS(field, label, width, align) {
    const isActive = _sortCol === field;
    const arrow = isActive ? (_sortDir===1?' ↑':' ↓') : '';
    return `<th onclick="CustomerModule.sortBy('${field}')"
      style="padding:8px 10px;text-align:${align||'left'};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${isActive?'#fbbf24':'#fff'};white-space:nowrap;cursor:pointer;width:${width}">
      ${label}${arrow}</th>`;
  }

  function setSearch(val) {
    _search = (val||'').toLowerCase().trim();
    _renderTbody();
  }

  function sortBy(col) {
    if (_sortCol === col) _sortDir *= -1; else { _sortCol = col; _sortDir = 1; }
    _renderTbody();
  }

  function openModal(id) {
    const c = id ? _data.find(x=>x.id===id) : null;
    const fv = (f) => c?.[f] ?? '';
    const nv = (f) => c?.[f] || 0;
    const numRow = (fields) => `<div style="display:grid;grid-template-columns:${fields.map(()=>'1fr').join(' ')};gap:var(--s3)">
      ${fields.map(([f,l]) => `<div class="form-group"><label class="form-label">${l}</label><input id="cf-${f}" type="number" min="0" class="form-control" value="${nv(f)}" style="text-align:right;font-family:var(--font-mono)"></div>`).join('')}
    </div>`;
    Modal.open({
      title: c ? 'Edit Customer' : 'Tambah Customer',
      size: 'modal-xl',
      body: `<style>.modal-xl{max-width:900px!important}.cf-s{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);padding:10px 0 6px;border-top:1px solid var(--border);margin-top:4px}</style>
        <div class="cf-s">Info Umum</div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:var(--s3)">
          <div class="form-group"><label class="form-label">Nama Perusahaan <span style="color:var(--danger)">*</span></label><input class="form-control" id="cf-nama" value="${fv('nama')}" placeholder="PT. ..."></div>
          <div class="form-group"><label class="form-label">Jenis Pelayanan</label><select class="form-control" id="cf-jenis">${['','Rantang','Bento','Prasmanan','Paper Box'].map(j=>`<option value="${j}" ${fv('jenisPelayanan')===j?'selected':''}>${j||'— Pilih —'}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="cf-status"><option value="AKTIF" ${(fv('status')||'AKTIF')==='AKTIF'?'selected':''}>Aktif</option><option value="NON-AKTIF" ${fv('status')==='NON-AKTIF'?'selected':''}>Non-Aktif</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--s3)">
          <div class="form-group"><label class="form-label">PIC</label><input class="form-control" id="cf-pic" value="${fv('pic')}"></div>
          <div class="form-group"><label class="form-label">No. HP</label><input class="form-control" id="cf-noHp" value="${fv('noHp')}"></div>
          <div class="form-group"><label class="form-label">Kota</label><input class="form-control" id="cf-kota" value="${fv('kota')||'Karawang'}"></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="cf-email" type="email" value="${fv('email')}"></div>
        </div>
        <div class="form-group"><label class="form-label">Alamat</label><input class="form-control" id="cf-alamat" value="${fv('alamat')}"></div>
        <div class="cf-s">Kontrak & Tarif Dasar</div>
        ${numRow([['hargaPerPax','Harga / Pax (Rp)'],['biayaBox','Biaya Box (Rp)'],['biayaLainnya','Biaya Lainnya (Rp)'],['tempo','Tempo (hari)'],['potonganAyam','Potongan Ayam (kg)'],['potonganDaging','Potongan Daging (kg)'],['qtyLauk','Qty Lauk'],['qtyPendamping','Qty Pendamping']])}
        <div class="cf-s">Harga Per Shift (Rp)</div>
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
        <div class="cf-s">Catatan</div>
        <div class="form-group"><input class="form-control" id="cf-catatan" value="${fv('catatan')}" placeholder="Catatan tambahan..."></div>`,
      buttons: [
        {label:'Batal', class:'btn-ghost', onclick:'Modal.close()'},
        {label: c?'Simpan Perubahan':'Tambah Customer', class:'btn-primary', onclick:`CustomerModule._submit('${c?.id||''}')`}
      ]
    });
  }

  function _submit(id) {
    const g = sel => document.getElementById(sel)?.value?.trim() || '';
    const n = sel => parseFloat(document.getElementById(sel)?.value) || 0;
    const nama = g('cf-nama');
    if (!nama) { Notify.warning('Nama perusahaan wajib diisi'); return; }
    const obj = {
      id: id || Utils.uid(), nama,
      pic: g('cf-pic'), noHp: g('cf-noHp'), kota: g('cf-kota'),
      status: g('cf-status'), alamat: g('cf-alamat'), email: g('cf-email'),
      jenisPelayanan: g('cf-jenis'), catatan: g('cf-catatan'),
      hargaPerPax: n('cf-hargaPerPax'), biayaBox: n('cf-biayaBox'),
      biayaLainnya: n('cf-biayaLainnya'), tempo: n('cf-tempo'),
      potonganAyam: n('cf-potonganAyam'), potonganDaging: n('cf-potonganDaging'),
      qtyLauk: n('cf-qtyLauk'), qtyPendamping: n('cf-qtyPendamping'),
      hargaBreakfast: n('cf-hargaBreakfast'),
      hargaShift1: n('cf-hargaShift1'), hargaSpare1: n('cf-hargaSpare1'),
      hargaOT1: n('cf-hargaOT1'), hargaSnack1: n('cf-hargaSnack1'),
      hargaShift2: n('cf-hargaShift2'), hargaSpare2: n('cf-hargaSpare2'),
      hargaOT2: n('cf-hargaOT2'), hargaSnack2: n('cf-hargaSnack2'),
      hargaShift3: n('cf-hargaShift3'), hargaSpare3: n('cf-hargaSpare3'),
      hargaOT3: n('cf-hargaOT3'), hargaSnack3: n('cf-hargaSnack3'),
      hargaSnackBerat: n('cf-hargaSnackBerat'),
    };
    if (id) { const i = _data.findIndex(c=>c.id===id); if (i>=0) _data[i]=obj; else _data.push(obj); }
    else _data.push(obj);
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    Modal.close();
    Notify.success(id?'Customer diperbarui':'Customer berhasil ditambahkan');
    _renderFull();
  }

  return { init, setSearch, sortBy, openModal, _submit };
})();

window.CustomerModule = CustomerModule;
