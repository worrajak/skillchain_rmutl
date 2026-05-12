-- Multi-approver flow for batch approval — รองอธิการเซ็นก่อน อธิการเซ็นทีหลัง
-- See docs/BATCH_APPROVAL_PROPOSAL.md (Sprint 3 follow-up)
--
-- New lifecycle:
--   COMPILED → REVIEWED (รองอธิการบดี approve) → APPROVED (อธิการบดี approve) → CLOSED
--   any stage → REJECTED (rollback)

-- Drop existing status check + add REVIEWED
ALTER TABLE skc_gov_approval_batches
  DROP CONSTRAINT IF EXISTS skc_gov_approval_batches_status_check;

ALTER TABLE skc_gov_approval_batches
  ADD CONSTRAINT skc_gov_approval_batches_status_check
  CHECK (status IN ('PENDING','COMPILED','REVIEWED','APPROVED','REJECTED','CLOSED'));

-- Add reviewer columns (vice rector / รองอธิการ)
ALTER TABLE skc_gov_approval_batches
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES skc_users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

COMMENT ON COLUMN skc_gov_approval_batches.reviewed_by IS
  'Vice rector (รองอธิการบดี) who reviewed before submitting to rector. Optional — single-approver flow still supported.';

NOTIFY pgrst, 'reload schema';
