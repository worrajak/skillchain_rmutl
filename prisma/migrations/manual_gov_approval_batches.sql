-- Batch Activity Approval — rollup of multiple jobs into one signed document
-- One batch document gets reviewed and signed instead of N per-job documents.
-- See docs/BATCH_APPROVAL_PROPOSAL.md for full design.

-- =============================================================
-- 1) Main table
-- =============================================================
CREATE TABLE IF NOT EXISTS skc_gov_approval_batches (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Identifier (auto: 2026-05-A, 2026-05-B, ...)
  batch_no        TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,

  -- Period covered
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'COMPILED'
                  CHECK (status IN ('PENDING','COMPILED','APPROVED','REJECTED','CLOSED')),

  -- Document content
  document_md     TEXT,             -- generated Markdown
  document_pdf_url TEXT,            -- (optional) uploaded signed PDF (Supabase storage)
  approval_note   TEXT,             -- approver's notes
  reject_reason   TEXT,             -- if REJECTED

  -- Actors
  created_by      TEXT NOT NULL REFERENCES skc_users(id),
  approved_by     TEXT REFERENCES skc_users(id),
  rejected_by     TEXT REFERENCES skc_users(id),

  -- Cached summary (refreshed on insert/update)
  total_jobs      INT NOT NULL DEFAULT 0,
  total_students  INT NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  compiled_at     TIMESTAMPTZ DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON skc_gov_approval_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_period ON skc_gov_approval_batches(period_start, period_end);

-- =============================================================
-- 2) Link from jobs to batch
-- =============================================================
ALTER TABLE skc_jobs ADD COLUMN IF NOT EXISTS gov_batch_id TEXT
  REFERENCES skc_gov_approval_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_gov_batch ON skc_jobs(gov_batch_id);

-- =============================================================
-- 3) RLS
-- =============================================================
ALTER TABLE skc_gov_approval_batches ENABLE ROW LEVEL SECURITY;

-- READ: staff/admin see all; everyone else can see APPROVED ones for transparency
DROP POLICY IF EXISTS "batches_read" ON skc_gov_approval_batches;
CREATE POLICY "batches_read" ON skc_gov_approval_batches
  FOR SELECT
  USING (
    status = 'APPROVED'
    OR EXISTS (
      SELECT 1 FROM skc_users
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'project_staff', 'rmutl_staff', 'teacher')
    )
  );

-- WRITE: only staff/admin
DROP POLICY IF EXISTS "batches_write" ON skc_gov_approval_batches;
CREATE POLICY "batches_write" ON skc_gov_approval_batches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM skc_users
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'project_staff', 'rmutl_staff')
    )
  );

-- =============================================================
-- 4) Helper: next batch number for a year-month
-- =============================================================
CREATE OR REPLACE FUNCTION fn_next_batch_no(p_year_month TEXT)
RETURNS TEXT AS $$
DECLARE
  existing_count INT;
  letter TEXT;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM skc_gov_approval_batches
  WHERE batch_no LIKE p_year_month || '-%';

  -- A, B, C, ... Z, then AA, AB, ... (unlikely to hit, but safe)
  IF existing_count < 26 THEN
    letter := CHR(65 + existing_count); -- 65 = 'A'
  ELSE
    letter := CHR(65 + (existing_count / 26) - 1) || CHR(65 + (existing_count % 26));
  END IF;

  RETURN p_year_month || '-' || letter;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_next_batch_no(TEXT) TO authenticated;

-- =============================================================
-- 5) Refresh batch totals (used by APIs when jobs change)
-- =============================================================
CREATE OR REPLACE FUNCTION fn_refresh_batch_totals(p_batch_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE skc_gov_approval_batches b
  SET
    total_jobs = COALESCE((SELECT COUNT(*) FROM skc_jobs WHERE gov_batch_id = p_batch_id), 0),
    total_students = COALESCE((SELECT SUM(required_workers) FROM skc_jobs WHERE gov_batch_id = p_batch_id), 0),
    total_amount = COALESCE((SELECT SUM(pay_amount) FROM skc_jobs WHERE gov_batch_id = p_batch_id), 0)
  WHERE b.id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_refresh_batch_totals(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
