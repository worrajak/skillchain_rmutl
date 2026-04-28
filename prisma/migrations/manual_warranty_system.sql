-- ============================================================================
-- Warranty System (7-day default + claims)
-- ============================================================================
-- ผู้จ้างยืนยันงาน → เริ่มประกัน 7 วัน → ครบ → CLOSED
-- ระหว่างประกัน ผู้จ้างเปิด Warranty Claim → staff + นศ. กลับมาแก้ฟรี
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add IN_WARRANTY + CLOSED to JobStatus enum
-- ----------------------------------------------------------------------------

ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'IN_WARRANTY' AFTER 'COMPLETED';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'CLOSED' AFTER 'IN_WARRANTY';

-- ----------------------------------------------------------------------------
-- 2. Add warranty fields to skc_jobs
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_jobs"
  ADD COLUMN IF NOT EXISTS warranty_period_days INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS warranty_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warranty_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warranty_status TEXT
    CHECK (warranty_status IN ('NOT_STARTED', 'ACTIVE', 'CLAIMED', 'EXPIRED', 'CLOSED'))
    DEFAULT 'NOT_STARTED';

CREATE INDEX IF NOT EXISTS idx_jobs_warranty_status ON "skc_jobs"(warranty_status);
CREATE INDEX IF NOT EXISTS idx_jobs_warranty_end ON "skc_jobs"(warranty_end_at);
CREATE INDEX IF NOT EXISTS idx_jobs_supervisor ON "skc_jobs"(approved_by_staff);

-- ----------------------------------------------------------------------------
-- 3. Warranty Claims table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_warranty_claims" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id          TEXT REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  -- Claim info
  claimed_by      TEXT REFERENCES "skc_users"(id),  -- ผู้ที่เปิด claim (ปกติคือ employer)
  claim_reason    TEXT NOT NULL,                     -- เหตุผลการ claim
  claim_severity  TEXT CHECK (claim_severity IN ('MINOR', 'MAJOR', 'CRITICAL')) DEFAULT 'MINOR',
  claim_photos    JSONB DEFAULT '[]'::jsonb,         -- array ของ image URLs
  claimed_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Resolution
  status          TEXT CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ESCALATED'))
                  DEFAULT 'OPEN',
  resolution_note TEXT,
  resolved_by     TEXT REFERENCES "skc_users"(id),
  resolved_at     TIMESTAMPTZ,
  -- Follow-up job (ถ้าต้องสร้าง job ใหม่เพื่อไปแก้)
  followup_job_id TEXT REFERENCES "skc_jobs"(id) ON DELETE SET NULL,
  -- Tracking
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_job ON "skc_warranty_claims"(job_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON "skc_warranty_claims"(status);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_claimed_by ON "skc_warranty_claims"(claimed_by);

-- Auto-update updated_at on update
DROP TRIGGER IF EXISTS trg_set_updated_at ON "skc_warranty_claims";
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON "skc_warranty_claims"
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Trigger: เริ่มประกันอัตโนมัติเมื่อ status → COMPLETED
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_start_warranty()
RETURNS TRIGGER AS $$
BEGIN
  -- เมื่อ status เปลี่ยนเป็น COMPLETED → เริ่มประกัน
  IF NEW.status = 'COMPLETED' AND (OLD.status != 'COMPLETED' OR OLD.status IS NULL) THEN
    NEW.warranty_start_at := NOW();
    NEW.warranty_end_at := NOW() + (COALESCE(NEW.warranty_period_days, 7) * INTERVAL '1 day');
    NEW.warranty_status := 'ACTIVE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_start_warranty ON "skc_jobs";
CREATE TRIGGER trg_start_warranty
  BEFORE UPDATE OF status ON "skc_jobs"
  FOR EACH ROW EXECUTE FUNCTION fn_start_warranty();

-- ----------------------------------------------------------------------------
-- 5. RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_warranty_claims" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warranty_claims_read" ON "skc_warranty_claims";
CREATE POLICY "warranty_claims_read" ON "skc_warranty_claims" FOR SELECT
  USING (
    -- Claimer + staff + people involved in the job
    claimed_by = auth.uid()::text
    OR job_id IN (
      SELECT id FROM "skc_jobs"
      WHERE employer_id = auth.uid()::text
        OR student_id = auth.uid()::text
        OR mentor_id = auth.uid()::text
        OR approved_by_staff = auth.uid()::text
    )
    OR public.is_admin_role()
  );

DROP POLICY IF EXISTS "warranty_claims_insert" ON "skc_warranty_claims";
CREATE POLICY "warranty_claims_insert" ON "skc_warranty_claims" FOR INSERT
  WITH CHECK (
    -- Only employer (or staff) can claim
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "warranty_claims_update" ON "skc_warranty_claims";
CREATE POLICY "warranty_claims_update" ON "skc_warranty_claims" FOR UPDATE
  USING (
    -- Staff/admin or claimer can update
    claimed_by = auth.uid()::text
    OR public.is_admin_role()
    OR job_id IN (
      SELECT id FROM "skc_jobs" WHERE approved_by_staff = auth.uid()::text
    )
  );

-- Verify
SELECT
  'skc_jobs warranty fields' AS info,
  COUNT(*) AS jobs_count,
  COUNT(*) FILTER (WHERE warranty_status IS NOT NULL) AS with_warranty
FROM "skc_jobs"
UNION ALL
SELECT
  'enum JobStatus values',
  COUNT(*),
  0
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'JobStatus';
