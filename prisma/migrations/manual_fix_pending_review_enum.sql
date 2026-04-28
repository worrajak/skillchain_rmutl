-- ============================================================================
-- FIX: Add PENDING_REVIEW to JobStatus enum
-- ============================================================================
-- Error: 22P02 — invalid input value for enum "JobStatus": "PENDING_REVIEW"
-- The form inserts jobs with status='PENDING_REVIEW' but enum doesn't have it.
-- This was supposed to be added in manual_job_review.sql but didn't run after
-- the skc_ prefix refactor.
-- ============================================================================

-- Add PENDING_REVIEW to JobStatus enum (if not already present)
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'OPEN';

-- Verify all enum values
SELECT
  t.typname AS enum_name,
  ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'JobStatus'
GROUP BY t.typname;
