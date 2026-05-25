-- ============================================
-- BECCA V2.0 — HACCP Tables Setup
-- Jalankan di Supabase SQL Editor (sekali saja).
-- Skema mengikuti pattern BECCA: id text PK + data jsonb.
-- ============================================

-- Tabel: Log Suhu (chiller, freezer, hot holding, core cook)
CREATE TABLE IF NOT EXISTS haccp_temp_log (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_haccp_temp_tgl ON haccp_temp_log ((data->>'tgl'));
CREATE INDEX IF NOT EXISTS idx_haccp_temp_area ON haccp_temp_log ((data->>'area'));

-- Tabel: Checklist Sanitasi harian
CREATE TABLE IF NOT EXISTS haccp_sanitation (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_haccp_sanit_tgl ON haccp_sanitation ((data->>'tgl'));

-- Tabel: Penerimaan Bahan (supplier batch + expiry tracking)
CREATE TABLE IF NOT EXISTS haccp_receiving (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_haccp_rec_tgl ON haccp_receiving ((data->>'tgl'));
CREATE INDEX IF NOT EXISTS idx_haccp_rec_supplier ON haccp_receiving ((data->>'supplierId'));

-- RLS: enable + allow anon CRUD (auth di application layer, sama dengan tabel BECCA lain)
ALTER TABLE haccp_temp_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_sanitation  ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_receiving   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY haccp_temp_anon_all ON haccp_temp_log FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY haccp_sanit_anon_all ON haccp_sanitation FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY haccp_rec_anon_all ON haccp_receiving FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optional: trigger auto-update updated_at (jika belum ada function-nya)
-- Sudah ada di setup BECCA awal, skip kalau error.
DO $$ BEGIN
  CREATE TRIGGER haccp_temp_updated_at BEFORE UPDATE ON haccp_temp_log FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER haccp_sanit_updated_at BEFORE UPDATE ON haccp_sanitation FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER haccp_rec_updated_at BEFORE UPDATE ON haccp_receiving FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN undefined_function THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- Selesai. Verifikasi:
-- SELECT count(*) FROM haccp_temp_log;
-- SELECT count(*) FROM haccp_sanitation;
-- SELECT count(*) FROM haccp_receiving;
-- ============================================
