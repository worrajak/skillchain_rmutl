-- ============================================================================
-- FIX: skc_jobs review columns missing
-- ============================================================================
-- Error: "Could not find the 'review_note' column of 'skc_jobs' in the schema cache"
-- Caused by:
--  1) manual_job_review.sql wasn't run after the last DB reset, OR
--  2) it was run but ADD COLUMN ... UUID REFERENCES skc_users(id) failed silently
--     because skc_users.id is TEXT (Prisma String, not UUID type)
--
-- This migration is idempotent and uses TEXT to match skc_users.id type.
-- ============================================================================

-- Drop any old broken column definitions if they exist with wrong type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skc_jobs'
      AND column_name = 'reviewed_by_staff'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE skc_jobs DROP COLUMN reviewed_by_staff;
  END IF;
END $$;

-- Add the columns (idempotent)
ALTER TABLE skc_jobs ADD COLUMN IF NOT EXISTS reviewed_by_staff TEXT REFERENCES skc_users(id);
ALTER TABLE skc_jobs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE skc_jobs ADD COLUMN IF NOT EXISTS review_note TEXT;

-- Refresh PostgREST schema cache so Supabase client sees new columns immediately
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT
  column_name,
  data_type,
  CASE WHEN is_nullable = 'YES' THEN 'nullable' ELSE 'NOT NULL' END AS nullable
FROM information_schema.columns
WHERE table_name = 'skc_jobs'
  AND column_name IN ('reviewed_by_staff', 'reviewed_at', 'review_note')
ORDER BY column_name;
