-- Hapus semua data Kas Kecil (jalankan di Supabase SQL Editor)
-- AMAN: hanya table kas dan kas_masuk, data lain tidak terpengaruh

DELETE FROM public.kas;
DELETE FROM public.kas_masuk;

-- Verifikasi (uncomment untuk cek)
-- SELECT COUNT(*) AS sisa_kas FROM public.kas;
-- SELECT COUNT(*) AS sisa_kas_masuk FROM public.kas_masuk;
