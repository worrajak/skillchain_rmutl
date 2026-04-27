-- ============================================================================
-- Open RLS Policies for SkillChain skc_* tables
-- ============================================================================
-- เปิด RLS + ให้ authenticated user อ่านได้
-- เพื่อให้ frontend เห็นข้อมูล (ระบบยังเป็น Phase ทดสอบ)
-- หลัง Production จริงควรเข้มขึ้น
-- ============================================================================

-- skc_users — ทุกคนที่ login แล้วอ่านได้, แก้ไขเฉพาะ admin
ALTER TABLE "skc_users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skc_users_read_all" ON "skc_users";
CREATE POLICY "skc_users_read_all" ON "skc_users" FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "skc_users_admin_write" ON "skc_users";
CREATE POLICY "skc_users_admin_write" ON "skc_users" FOR ALL
  USING (
    auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "skc_users_self_update" ON "skc_users";
CREATE POLICY "skc_users_self_update" ON "skc_users" FOR UPDATE
  USING (id = auth.uid()::text);

-- skc_jobs — read all (public), write by employer/staff/student
ALTER TABLE "skc_jobs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skc_jobs_read_all" ON "skc_jobs";
CREATE POLICY "skc_jobs_read_all" ON "skc_jobs" FOR SELECT USING (true);

DROP POLICY IF EXISTS "skc_jobs_employer_create" ON "skc_jobs";
CREATE POLICY "skc_jobs_employer_create" ON "skc_jobs" FOR INSERT
  WITH CHECK (
    employer_id = auth.uid()::text
    OR auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "skc_jobs_update" ON "skc_jobs";
CREATE POLICY "skc_jobs_update" ON "skc_jobs" FOR UPDATE
  USING (
    employer_id = auth.uid()::text
    OR student_id = auth.uid()::text
    OR mentor_id = auth.uid()::text
    OR auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "skc_jobs_delete" ON "skc_jobs";
CREATE POLICY "skc_jobs_delete" ON "skc_jobs" FOR DELETE
  USING (
    auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin')
    )
  );

-- ============ Open read for the rest of skc_* tables ============
-- (read-only — frontend จะใช้ get-then-display)
-- write ต้อง explicit grants ตามแต่ละ business

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'skc_evaluations',
    'skc_employer_reviews',
    'skc_student_reviews',
    'skc_mentor_reviews',
    'skc_student_credentials',
    'skc_student_qualifications',
    'skc_student_tiers',
    'skc_student_availability',
    'skc_student_rating_summary',
    'skc_employer_rating_summary',
    'skc_notifications',
    'skc_job_chat_rooms',
    'skc_chat_messages',
    'skc_chat_participants',
    'skc_job_assignment_requests',
    'skc_job_cancellation_requests',
    'skc_job_agreements',
    'skc_disputes',
    'skc_approval_logs',
    'skc_fee_config',
    'skc_behavior_logs',
    'skc_donation_funds'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_read_all" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_read_all" ON %I FOR SELECT USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_write" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_authenticated_write" ON %I FOR ALL USING (auth.role() = ''authenticated'')', t, t);
  END LOOP;
END $$;

-- Verify
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'skc_%' AND c.relkind = 'r'
ORDER BY c.relname;
