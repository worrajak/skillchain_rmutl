-- Team jobs MVP — allow N students per job (default 1, so existing jobs stay solo).
--
-- Design notes:
--   - skc_jobs.required_workers: how many students the job needs (UI gates apply/approve)
--   - skc_jobs.student_id: kept as "team lead" pointer for backward compat
--   - skc_job_workers: junction table — full team membership, one row per (job, student)
--
-- Equal-split escrow: release-escrow API divides pay_amount equally among workers.
-- Lead role: first approved worker = LEAD, others = WORKER. Lead submits work for the team.

-- =============================================================
-- 1) skc_jobs: required_workers column
-- =============================================================
ALTER TABLE skc_jobs
  ADD COLUMN IF NOT EXISTS required_workers INT NOT NULL DEFAULT 1
  CHECK (required_workers BETWEEN 1 AND 20);

COMMENT ON COLUMN skc_jobs.required_workers IS
  'Number of student workers this job needs. Default 1 (solo). MVP: equal pay split.';

-- =============================================================
-- 2) skc_job_workers junction table
-- =============================================================
CREATE TABLE IF NOT EXISTS skc_job_workers (
  job_id     TEXT NOT NULL REFERENCES skc_jobs(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES skc_users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'WORKER'
             CHECK (role IN ('LEAD', 'WORKER', 'TRAINEE')),
  added_by   TEXT REFERENCES skc_users(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_job_workers_student ON skc_job_workers(student_id);
CREATE INDEX IF NOT EXISTS idx_job_workers_job ON skc_job_workers(job_id);

COMMENT ON TABLE skc_job_workers IS
  'Team membership for jobs. One row per (job, student). Lead is the team lead.';

-- =============================================================
-- 3) RLS
-- =============================================================
ALTER TABLE skc_job_workers ENABLE ROW LEVEL SECURITY;

-- READ: workers see their own teams; staff/admin/teacher/employer see all; employer sees their own job's team
DROP POLICY IF EXISTS "job_workers_read" ON skc_job_workers;
CREATE POLICY "job_workers_read" ON skc_job_workers
  FOR SELECT
  USING (
    student_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM skc_users
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'project_staff', 'rmutl_staff', 'teacher', 'employer')
    )
  );

-- INSERT/DELETE: only staff/admin (manage team membership)
DROP POLICY IF EXISTS "job_workers_write" ON skc_job_workers;
CREATE POLICY "job_workers_write" ON skc_job_workers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM skc_users
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'project_staff', 'rmutl_staff', 'teacher')
    )
  );

-- =============================================================
-- 4) Backfill — existing single-student jobs become 1-person teams
-- =============================================================
INSERT INTO skc_job_workers (job_id, student_id, role, added_by, added_at)
SELECT
  j.id,
  j.student_id,
  'LEAD' AS role,
  j.approved_by_staff AS added_by,
  COALESCE(j.staff_approval_at, j.created_at) AS added_at
FROM skc_jobs j
WHERE j.student_id IS NOT NULL
ON CONFLICT (job_id, student_id) DO NOTHING;

-- =============================================================
-- 5) Helper view: team summary per job
-- =============================================================
DROP VIEW IF EXISTS v_skc_job_team_summary;
CREATE VIEW v_skc_job_team_summary AS
SELECT
  j.id AS job_id,
  j.required_workers,
  COUNT(w.student_id) AS current_workers,
  GREATEST(j.required_workers - COUNT(w.student_id), 0) AS open_spots,
  ARRAY_AGG(w.student_id ORDER BY w.role DESC, w.added_at) FILTER (WHERE w.student_id IS NOT NULL) AS worker_ids,
  MAX(w.student_id) FILTER (WHERE w.role = 'LEAD') AS lead_id
FROM skc_jobs j
LEFT JOIN skc_job_workers w ON w.job_id = j.id
GROUP BY j.id, j.required_workers;

GRANT SELECT ON v_skc_job_team_summary TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
