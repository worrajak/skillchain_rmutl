-- Allow students to self-register + self-check-in for ACTIVITY (FCFS) jobs
-- Bug: when migrating manual_team_jobs.sql we restricted skc_job_workers write
-- to staff/admin only. ACTIVITY mode needs students to insert their own row +
-- update their own attendance_status (check-in).

-- 1) Student self-register — INSERT own PARTICIPANT row in an OPEN activity (FCFS)
DROP POLICY IF EXISTS "job_workers_student_self_register" ON skc_job_workers;
CREATE POLICY "job_workers_student_self_register" ON skc_job_workers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()::text
    AND role = 'PARTICIPANT'
    AND EXISTS (
      SELECT 1 FROM skc_jobs
      WHERE id = job_id
        AND engagement_mode = 'ACTIVITY'
        AND registration_mode = 'FCFS'
        AND status IN ('OPEN', 'ASSIGNED')
    )
  );

-- 2) Student self-update — UPDATE own row (for QR check-in flow)
--    Only their own attendance_status field is meaningful; the API guards the rest.
DROP POLICY IF EXISTS "job_workers_student_self_update" ON skc_job_workers;
CREATE POLICY "job_workers_student_self_update" ON skc_job_workers
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid()::text)
  WITH CHECK (student_id = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
