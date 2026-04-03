-- ============================================================
--  BECCA V2.0 — Create Missing Tables
--  Jalankan di: Supabase Dashboard → SQL Editor → New Query
--  AMAN dijalankan berulang (IF NOT EXISTS)
-- ============================================================

-- ── emp_absensi ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emp_absensi (
  id         TEXT PRIMARY KEY,
  empId      TEXT,
  empNama    TEXT,
  tgl        TEXT,
  status     TEXT,
  ket        TEXT,
  createdAt  TEXT,
  data       JSONB
);
ALTER TABLE public.emp_absensi DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.emp_absensi TO anon;

-- ── emp_jadwal ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emp_jadwal (
  id         TEXT PRIMARY KEY,
  empId      TEXT,
  empNama    TEXT,
  tgl        TEXT,
  shift      TEXT,
  keterangan TEXT,
  createdAt  TEXT,
  data       JSONB
);
ALTER TABLE public.emp_jadwal DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.emp_jadwal TO anon;

-- ── emp_payroll ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emp_payroll (
  id         TEXT PRIMARY KEY,
  empId      TEXT,
  empNama    TEXT,
  bulan      TEXT,
  tahun      TEXT,
  gaji_pokok NUMERIC,
  tunjangan  NUMERIC,
  potongan   NUMERIC,
  total      NUMERIC,
  status     TEXT,
  createdAt  TEXT,
  data       JSONB
);
ALTER TABLE public.emp_payroll DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.emp_payroll TO anon;

-- ── push_tokens ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT,
  username   TEXT,
  nama       TEXT,
  role       TEXT,
  divisi     TEXT,
  jabatan    TEXT,
  device     TEXT,
  last_seen  TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.push_tokens DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.push_tokens TO anon;

-- ── delivery_checkpoints ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_checkpoints (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);
ALTER TABLE public.delivery_checkpoints DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_checkpoints TO anon;

-- ── delivery_tracking_logs ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_tracking_logs (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);
ALTER TABLE public.delivery_tracking_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_tracking_logs TO anon;

-- ── menu_library ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_library (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);
ALTER TABLE public.menu_library DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.menu_library TO anon;

-- ── menu_plans ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_plans (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);
ALTER TABLE public.menu_plans DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.menu_plans TO anon;

-- ── personal_notes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_notes (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);
ALTER TABLE public.personal_notes DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.personal_notes TO anon;

-- ── delivery_schedules ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_schedules (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);
ALTER TABLE public.delivery_schedules DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.delivery_schedules TO anon;

-- ── news (pengumuman) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);
ALTER TABLE public.news DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.news TO anon;
