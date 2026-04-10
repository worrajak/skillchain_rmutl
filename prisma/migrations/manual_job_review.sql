-- Add job review columns (staff reviews job before publishing)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reviewed_by_staff UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS review_note TEXT;
