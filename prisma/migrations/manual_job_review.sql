-- Add PENDING_REVIEW to JobStatus enum
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'OPEN';

-- Add job review columns (staff reviews job before publishing)
ALTER TABLE skc_jobs ADD COLUMN IF NOT EXISTS reviewed_by_staff UUID REFERENCES skc_users(id);
ALTER TABLE skc_jobs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE skc_jobs ADD COLUMN IF NOT EXISTS review_note TEXT;
