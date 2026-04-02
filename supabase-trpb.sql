-- ==========================================
-- SkillChain RMUTL — TRPB Token + Fee Structure
-- Run this in Supabase SQL Editor
-- ==========================================

-- Fee configuration table
CREATE TABLE IF NOT EXISTS fee_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_bps     INTEGER NOT NULL DEFAULT 8500,   -- 85%
  fund_bps        INTEGER NOT NULL DEFAULT 500,    -- 5%
  mentor_bps      INTEGER NOT NULL DEFAULT 500,    -- 5%
  staff_bps       INTEGER NOT NULL DEFAULT 500,    -- 5%
  updated_by      UUID REFERENCES users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (student_bps + fund_bps + mentor_bps + staff_bps = 10000)
);

-- Insert default config
INSERT INTO fee_config (student_bps, fund_bps, mentor_bps, staff_bps)
SELECT 8500, 500, 500, 500
WHERE NOT EXISTS (SELECT 1 FROM fee_config);

-- Escrow records
CREATE TABLE IF NOT EXISTS escrow_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  employer_id     UUID NOT NULL REFERENCES users(id),
  student_id      UUID REFERENCES users(id),
  mentor_id       UUID REFERENCES users(id),
  total_amount    DOUBLE PRECISION NOT NULL,
  student_amount  DOUBLE PRECISION NOT NULL DEFAULT 0,
  fund_amount     DOUBLE PRECISION NOT NULL DEFAULT 0,
  mentor_amount   DOUBLE PRECISION NOT NULL DEFAULT 0,
  staff_amount    DOUBLE PRECISION NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD','RELEASED','REFUNDED','PARTIAL')),
  tx_hash         TEXT,             -- on-chain transaction
  released_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escrow_job ON escrow_records(job_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_records(status);

-- RLS
DO $$ BEGIN
  ALTER TABLE fee_config ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "allow_all" ON fee_config;
  CREATE POLICY "allow_all" ON fee_config FOR ALL USING (true) WITH CHECK (true);
  ALTER TABLE escrow_records ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "allow_all" ON escrow_records;
  CREATE POLICY "allow_all" ON escrow_records FOR ALL USING (true) WITH CHECK (true);
END $$;
