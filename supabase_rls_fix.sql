-- ============================================================
--  BECCA V2.0 — Supabase RLS Fix
--  Jalankan di: Supabase Dashboard → SQL Editor → New Query
--
--  Masalah yang diselesaikan:
--  - Data tidak terlihat di device lain (Issue 4)
--  - User lain tidak bisa login dari device lain (Issue 5)
--  - Task hilang setelah force reload di device berbeda (Issue 3)
--
--  Root cause: Supabase Row Level Security (RLS) aktif secara
--  default. Tanpa policy yang mengizinkan akses anon, semua
--  read/write dari browser akan di-blokir.
--
--  BECCA menggunakan auth layer sendiri (bukan Supabase Auth),
--  sehingga aman untuk disable RLS pada semua tabel BECCA.
-- ============================================================

-- ── Disable RLS pada semua tabel BECCA ──────────────────────

ALTER TABLE IF EXISTS public.users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kas              DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kas_masuk        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emp_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inv_activities   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inv_products     DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.opname_logs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ap               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.presence         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs    DISABLE ROW LEVEL SECURITY;

-- ── Grant akses anon role ke semua tabel ────────────────────
-- (Diperlukan jika tabel belum punya GRANT ke anon)

GRANT ALL ON public.users            TO anon;
GRANT ALL ON public.settings         TO anon;
GRANT ALL ON public.tasks            TO anon;
GRANT ALL ON public.orders           TO anon;
GRANT ALL ON public.invoices         TO anon;
GRANT ALL ON public.customers        TO anon;
GRANT ALL ON public.kas              TO anon;
GRANT ALL ON public.kas_masuk        TO anon;
GRANT ALL ON public.employees        TO anon;
GRANT ALL ON public.emp_logs         TO anon;
GRANT ALL ON public.inv_activities   TO anon;
GRANT ALL ON public.inv_products     TO anon;
GRANT ALL ON public.opname_logs      TO anon;
GRANT ALL ON public.ap               TO anon;
GRANT ALL ON public.suppliers        TO anon;
GRANT ALL ON public.presence         TO anon;
GRANT ALL ON public.activity_logs    TO anon;

-- ── Verifikasi (opsional: jalankan ini untuk cek hasil) ──────
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
