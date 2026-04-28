-- ============================================================================
-- FIX: Missing columns on skc_users (and related)
-- ============================================================================
-- These columns were added in legacy migrations that didn't run after
-- the skc_ prefix refactor. Adding them defensively here.
-- ============================================================================

-- skc_users — job quota system (employer)
ALTER TABLE "skc_users"
  ADD COLUMN IF NOT EXISTS job_quota INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_quota_used INTEGER DEFAULT 0;

-- skc_users — avatar
ALTER TABLE "skc_users"
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- skc_users — telegram link
ALTER TABLE "skc_users"
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- skc_users — PDPA
ALTER TABLE "skc_users"
  ADD COLUMN IF NOT EXISTS pdpa_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdpa_version TEXT;

-- skc_jobs — staff supervisor + scheduling
ALTER TABLE "skc_jobs"
  ADD COLUMN IF NOT EXISTS approved_by_staff TEXT,
  ADD COLUMN IF NOT EXISTS staff_approval_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_proposed_by TEXT,
  ADD COLUMN IF NOT EXISTS schedule_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS staff_confirmed_completion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS employer_confirmed_completion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escrow_tx TEXT,
  ADD COLUMN IF NOT EXISTS eval_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eval_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eval_window_days INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS gov_status TEXT,
  ADD COLUMN IF NOT EXISTS gov_project_id TEXT,
  ADD COLUMN IF NOT EXISTS gov_activity_id TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'skc_users'
  AND column_name IN ('job_quota', 'job_quota_used', 'avatar_url', 'telegram_chat_id')
ORDER BY column_name;
