-- ============================================================
-- BECCA — Push Tokens Table
-- Jalankan sekali di Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS push_tokens (
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

-- Index untuk query cepat per divisi / jabatan / role
CREATE INDEX IF NOT EXISTS idx_push_tokens_username ON push_tokens (username);
CREATE INDEX IF NOT EXISTS idx_push_tokens_divisi   ON push_tokens (divisi);
CREATE INDEX IF NOT EXISTS idx_push_tokens_jabatan  ON push_tokens (jabatan);
CREATE INDEX IF NOT EXISTS idx_push_tokens_role     ON push_tokens (role);

-- Disable RLS (sama seperti tabel lain di BECCA)
ALTER TABLE push_tokens DISABLE ROW LEVEL SECURITY;
