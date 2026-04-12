-- ============================================================
-- QR Code Check-in/out + PDPA Consent
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. PDPA consent tracking on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS pdpa_consented_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pdpa_version TEXT;

-- 2. Job check-in/check-out records
CREATE TABLE IF NOT EXISTS job_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('CHECK_IN', 'CHECK_OUT')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkins_job ON job_checkins(job_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON job_checkins(user_id);

-- 3. Training attendance (QR scan)
CREATE TABLE IF NOT EXISTS training_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES users(id),
  session_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, trainee_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_course ON training_attendance(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_trainee ON training_attendance(trainee_id);

-- 4. RLS policies
ALTER TABLE job_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_select" ON job_checkins FOR SELECT
  USING (user_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND j.employer_id = auth.uid()));

CREATE POLICY "checkins_insert" ON job_checkins FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "attendance_select" ON training_attendance FOR SELECT
  USING (trainee_id = auth.uid() OR public.is_staff());

CREATE POLICY "attendance_insert" ON training_attendance FOR INSERT
  WITH CHECK (trainee_id = auth.uid());

CREATE POLICY "attendance_update" ON training_attendance FOR UPDATE
  USING (trainee_id = auth.uid() OR public.is_staff());
