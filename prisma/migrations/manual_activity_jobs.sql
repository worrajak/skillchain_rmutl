-- Activity jobs MVP — รองรับกิจกรรมหมู่ 20-100 คน · จ่ายต่อคน fixed rate
-- ดูออกแบบเต็มที่ docs/ACTIVITY_JOBS_PROPOSAL.md
--
-- Confirmed design choices:
-- 1. pay_per_person = net (ระบบ gross up ให้)
-- 2. registration = FCFS auto-approve
-- 3. attendance = QR scan
-- 4. capacity max 100
-- 5. employer ก็สร้างได้
-- 6. NO_SHOW = ไม่ได้เงิน

-- =============================================================
-- 1) skc_jobs: engagement_mode + activity fields
-- =============================================================
DO $$ BEGIN
  CREATE TYPE skc_engagement_mode AS ENUM ('SOLO', 'TEAM', 'ACTIVITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE skc_jobs
  ADD COLUMN IF NOT EXISTS engagement_mode skc_engagement_mode NOT NULL DEFAULT 'SOLO',
  ADD COLUMN IF NOT EXISTS pay_per_person NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS event_location TEXT,
  ADD COLUMN IF NOT EXISTS registration_mode TEXT DEFAULT 'STAFF_APPROVE'
    CHECK (registration_mode IN ('STAFF_APPROVE', 'FCFS', 'INVITE_ONLY'));

COMMENT ON COLUMN skc_jobs.engagement_mode IS
  'SOLO=1 worker; TEAM=2-20 workers equal split; ACTIVITY=many workers paid per-person';
COMMENT ON COLUMN skc_jobs.pay_per_person IS
  'For ACTIVITY mode — net TRPB each student receives. System grosses up for fees.';
COMMENT ON COLUMN skc_jobs.event_date IS
  'For ACTIVITY — date of the event (separate from deadline).';
COMMENT ON COLUMN skc_jobs.registration_mode IS
  'How students join: STAFF_APPROVE (curated) | FCFS (auto-approve first N) | INVITE_ONLY';

-- ขยาย required_workers จาก 1-20 เป็น 1-100
ALTER TABLE skc_jobs
  DROP CONSTRAINT IF EXISTS skc_jobs_required_workers_check;
ALTER TABLE skc_jobs
  ADD CONSTRAINT skc_jobs_required_workers_check
    CHECK (required_workers BETWEEN 1 AND 100);

-- Backfill: existing jobs with required_workers > 1 → TEAM mode
UPDATE skc_jobs SET engagement_mode = 'TEAM' WHERE required_workers > 1 AND engagement_mode = 'SOLO';

-- =============================================================
-- 2) skc_job_workers: attendance tracking for ACTIVITY mode
-- =============================================================
DO $$ BEGIN
  CREATE TYPE skc_attendance_status AS ENUM
    ('REGISTERED','CHECKED_IN','ATTENDED','NO_SHOW','EXCUSED','PAID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE skc_job_workers
  DROP CONSTRAINT IF EXISTS skc_job_workers_role_check;
ALTER TABLE skc_job_workers
  ADD CONSTRAINT skc_job_workers_role_check
    CHECK (role IN ('LEAD','WORKER','TRAINEE','PARTICIPANT'));

ALTER TABLE skc_job_workers
  ADD COLUMN IF NOT EXISTS attendance_status skc_attendance_status NOT NULL DEFAULT 'REGISTERED',
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS attendance_note TEXT;

COMMENT ON COLUMN skc_job_workers.attendance_status IS
  'ACTIVITY mode lifecycle: REGISTERED → CHECKED_IN (QR scan) → ATTENDED (staff confirm) → PAID';
COMMENT ON COLUMN skc_job_workers.paid_amount IS
  'Actual TRPB paid to this participant — recorded at release time.';

CREATE INDEX IF NOT EXISTS idx_job_workers_attendance
  ON skc_job_workers(job_id, attendance_status);

-- =============================================================
-- 3) RLS update — students can mark their own check-in
-- =============================================================
-- (existing policies cover SELECT/INSERT/DELETE by staff; UPDATE for check-in is via SECURITY DEFINER fn)

-- =============================================================
-- 4) Helper view for activity rosters
-- =============================================================
DROP VIEW IF EXISTS v_skc_activity_roster;
CREATE VIEW v_skc_activity_roster AS
SELECT
  j.id AS job_id,
  j.title,
  j.engagement_mode,
  j.required_workers AS capacity,
  j.pay_per_person,
  j.event_date,
  COUNT(w.student_id) FILTER (WHERE w.attendance_status = 'REGISTERED') AS registered_count,
  COUNT(w.student_id) FILTER (WHERE w.attendance_status = 'CHECKED_IN') AS checked_in_count,
  COUNT(w.student_id) FILTER (WHERE w.attendance_status = 'ATTENDED') AS attended_count,
  COUNT(w.student_id) FILTER (WHERE w.attendance_status = 'NO_SHOW') AS no_show_count,
  COUNT(w.student_id) FILTER (WHERE w.attendance_status = 'PAID') AS paid_count,
  COUNT(w.student_id) AS total_count
FROM skc_jobs j
LEFT JOIN skc_job_workers w ON w.job_id = j.id
WHERE j.engagement_mode = 'ACTIVITY'
GROUP BY j.id;

GRANT SELECT ON v_skc_activity_roster TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
