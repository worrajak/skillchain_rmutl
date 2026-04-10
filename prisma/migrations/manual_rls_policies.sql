-- ============================================================
-- SkillChain RMUTL — Proper RLS Policies (replace allow_all)
-- Run in Supabase SQL Editor after backing up
-- ============================================================
-- Helper: get current user's role from users table
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is staff/admin
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin','superadmin','project_staff','rmutl_staff','teacher')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin','superadmin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Drop ALL existing allow_all policies
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I', t);
  END LOOP;
END $$;

-- Drop training system placeholder policies (from manual_training_system.sql)
DROP POLICY IF EXISTS "training_courses_read" ON public.training_courses;
DROP POLICY IF EXISTS "training_courses_insert" ON public.training_courses;
DROP POLICY IF EXISTS "training_courses_update" ON public.training_courses;
DROP POLICY IF EXISTS "training_modules_read" ON public.training_modules;
DROP POLICY IF EXISTS "training_modules_insert" ON public.training_modules;
DROP POLICY IF EXISTS "training_enrollments_read" ON public.training_enrollments;
DROP POLICY IF EXISTS "training_enrollments_insert" ON public.training_enrollments;
DROP POLICY IF EXISTS "training_enrollments_update" ON public.training_enrollments;
DROP POLICY IF EXISTS "module_assessments_read" ON public.module_assessments;
DROP POLICY IF EXISTS "module_assessments_insert" ON public.module_assessments;
DROP POLICY IF EXISTS "module_assessments_update" ON public.module_assessments;

-- ============================================================
-- 1. users
-- ============================================================
-- Everyone can read basic user info (name, role, campus, avatar)
-- Only self can update own profile
-- Staff/admin can update any user (approval, role, etc.)
CREATE POLICY "users_select" ON public.users FOR SELECT
  USING (true);

CREATE POLICY "users_insert" ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_self" ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_staff" ON public.users FOR UPDATE
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "users_delete_admin" ON public.users FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 2. jobs
-- ============================================================
-- Everyone can read open/public jobs
-- Employer can CRUD own jobs
-- Staff can manage all jobs
CREATE POLICY "jobs_select" ON public.jobs FOR SELECT
  USING (true);

CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT
  WITH CHECK (employer_id = auth.uid() OR public.is_staff());

CREATE POLICY "jobs_update_owner" ON public.jobs FOR UPDATE
  USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());

CREATE POLICY "jobs_update_staff" ON public.jobs FOR UPDATE
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "jobs_delete_owner" ON public.jobs FOR DELETE
  USING (employer_id = auth.uid() AND status IN ('PENDING_REVIEW','OPEN'));

CREATE POLICY "jobs_delete_admin" ON public.jobs FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- 3. evaluations
-- ============================================================
-- Staff/teacher can insert
-- Student can read own evaluations
-- Staff can read all
CREATE POLICY "evaluations_select_own" ON public.evaluations FOR SELECT
  USING (student_id = auth.uid() OR teacher_id = auth.uid() OR public.is_staff());

CREATE POLICY "evaluations_insert" ON public.evaluations FOR INSERT
  WITH CHECK (teacher_id = auth.uid() AND public.is_staff());

CREATE POLICY "evaluations_update_staff" ON public.evaluations FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 4. employer_reviews
-- ============================================================
CREATE POLICY "employer_reviews_select" ON public.employer_reviews FOR SELECT
  USING (employer_id = auth.uid() OR student_id = auth.uid() OR public.is_staff());

CREATE POLICY "employer_reviews_insert" ON public.employer_reviews FOR INSERT
  WITH CHECK (employer_id = auth.uid());

-- ============================================================
-- 5. student_reviews
-- ============================================================
CREATE POLICY "student_reviews_select" ON public.student_reviews FOR SELECT
  USING (student_id = auth.uid() OR employer_id = auth.uid() OR public.is_staff());

CREATE POLICY "student_reviews_insert" ON public.student_reviews FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- ============================================================
-- 6. mentor_reviews
-- ============================================================
CREATE POLICY "mentor_reviews_select" ON public.mentor_reviews FOR SELECT
  USING (mentor_id = auth.uid() OR trainee_id = auth.uid() OR public.is_staff());

CREATE POLICY "mentor_reviews_insert" ON public.mentor_reviews FOR INSERT
  WITH CHECK (mentor_id = auth.uid());

-- ============================================================
-- 7. notifications — only own
-- ============================================================
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
  WITH CHECK (true);  -- system/API inserts for any user

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 8. job_chat_rooms
-- ============================================================
CREATE POLICY "chat_rooms_select" ON public.job_chat_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (j.employer_id = auth.uid() OR j.student_id = auth.uid() OR j.mentor_id = auth.uid())
    )
    OR public.is_staff()
  );

CREATE POLICY "chat_rooms_insert" ON public.job_chat_rooms FOR INSERT
  WITH CHECK (true);  -- created by API when needed

CREATE POLICY "chat_rooms_update_staff" ON public.job_chat_rooms FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 9. chat_messages
-- ============================================================
CREATE POLICY "chat_messages_select" ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.room_id = chat_messages.room_id AND cp.user_id = auth.uid()
    )
    OR public.is_staff()
  );

CREATE POLICY "chat_messages_insert" ON public.chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- ============================================================
-- 10. chat_participants
-- ============================================================
CREATE POLICY "chat_participants_select" ON public.chat_participants FOR SELECT
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "chat_participants_insert" ON public.chat_participants FOR INSERT
  WITH CHECK (true);  -- API inserts

-- ============================================================
-- 11. disputes
-- ============================================================
CREATE POLICY "disputes_select" ON public.disputes FOR SELECT
  USING (raised_by = auth.uid() OR raised_against = auth.uid() OR public.is_staff());

CREATE POLICY "disputes_insert" ON public.disputes FOR INSERT
  WITH CHECK (raised_by = auth.uid());

CREATE POLICY "disputes_update_staff" ON public.disputes FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 12. dispute_comments (optional — table may not exist yet)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dispute_comments') THEN
    EXECUTE 'CREATE POLICY "dispute_comments_select" ON public.dispute_comments FOR SELECT USING (EXISTS (SELECT 1 FROM public.disputes d WHERE d.id = dispute_id AND (d.raised_by = auth.uid() OR d.raised_against = auth.uid())) OR public.is_staff())';
    EXECUTE 'CREATE POLICY "dispute_comments_insert" ON public.dispute_comments FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- ============================================================
-- 13. job_assignment_requests
-- ============================================================
CREATE POLICY "jar_select" ON public.job_assignment_requests FOR SELECT
  USING (student_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.employer_id = auth.uid()));

CREATE POLICY "jar_insert" ON public.job_assignment_requests FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "jar_update_staff" ON public.job_assignment_requests FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 14. job_cancellation_requests
-- ============================================================
CREATE POLICY "jcr_select" ON public.job_cancellation_requests FOR SELECT
  USING (requested_by = auth.uid() OR public.is_staff());

CREATE POLICY "jcr_insert" ON public.job_cancellation_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "jcr_update_staff" ON public.job_cancellation_requests FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 15. job_agreements
-- ============================================================
CREATE POLICY "agreements_select" ON public.job_agreements FOR SELECT
  USING (proposed_by = auth.uid() OR accepted_by = auth.uid() OR public.is_staff());

CREATE POLICY "agreements_insert" ON public.job_agreements FOR INSERT
  WITH CHECK (proposed_by = auth.uid());

CREATE POLICY "agreements_update" ON public.job_agreements FOR UPDATE
  USING (proposed_by = auth.uid() OR accepted_by = auth.uid() OR public.is_staff());

-- ============================================================
-- 16. student_credentials
-- ============================================================
CREATE POLICY "credentials_select" ON public.student_credentials FOR SELECT
  USING (true);  -- public for verification

CREATE POLICY "credentials_insert_staff" ON public.student_credentials FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "credentials_update_staff" ON public.student_credentials FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 17. student_tiers
-- ============================================================
CREATE POLICY "tiers_select" ON public.student_tiers FOR SELECT
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY "tiers_upsert_staff" ON public.student_tiers FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "tiers_update_staff" ON public.student_tiers FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 18. student_qualifications
-- ============================================================
CREATE POLICY "quals_select" ON public.student_qualifications FOR SELECT
  USING (student_id = auth.uid() OR public.is_staff());

CREATE POLICY "quals_upsert_staff" ON public.student_qualifications FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "quals_update_staff" ON public.student_qualifications FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 19. student_availability
-- ============================================================
CREATE POLICY "avail_select" ON public.student_availability FOR SELECT
  USING (true);  -- employers need to see availability

CREATE POLICY "avail_upsert_self" ON public.student_availability FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "avail_update_self" ON public.student_availability FOR UPDATE
  USING (student_id = auth.uid() OR public.is_staff());

-- ============================================================
-- 20. donation_funds
-- ============================================================
CREATE POLICY "donations_select" ON public.donation_funds FOR SELECT
  USING (donor_id = auth.uid() OR public.is_staff());

CREATE POLICY "donations_insert" ON public.donation_funds FOR INSERT
  WITH CHECK (donor_id = auth.uid());

-- ============================================================
-- 21. behavior_logs — staff only
-- ============================================================
CREATE POLICY "behavior_select_staff" ON public.behavior_logs FOR SELECT
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "behavior_insert" ON public.behavior_logs FOR INSERT
  WITH CHECK (true);  -- API inserts

-- ============================================================
-- 22. approval_logs — staff only
-- ============================================================
CREATE POLICY "approval_logs_select" ON public.approval_logs FOR SELECT
  USING (public.is_staff() OR user_id = auth.uid());

CREATE POLICY "approval_logs_insert" ON public.approval_logs FOR INSERT
  WITH CHECK (true);  -- API inserts

-- ============================================================
-- 23. fee_config — admin write, all read
-- ============================================================
CREATE POLICY "fee_config_select" ON public.fee_config FOR SELECT
  USING (true);

CREATE POLICY "fee_config_update_admin" ON public.fee_config FOR UPDATE
  USING (public.is_admin());

-- ============================================================
-- 24. escrow_records (optional — table may not exist yet)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escrow_records') THEN
    EXECUTE 'CREATE POLICY "escrow_select" ON public.escrow_records FOR SELECT USING (employer_id = auth.uid() OR student_id = auth.uid() OR public.is_staff())';
    EXECUTE 'CREATE POLICY "escrow_insert" ON public.escrow_records FOR INSERT WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "escrow_update_staff" ON public.escrow_records FOR UPDATE USING (public.is_staff())';
  END IF;
END $$;

-- ============================================================
-- 25. job_images (optional — table may not exist yet)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_images') THEN
    EXECUTE 'CREATE POLICY "job_images_select" ON public.job_images FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "job_images_insert" ON public.job_images FOR INSERT WITH CHECK (uploaded_by = auth.uid())';
    EXECUTE 'CREATE POLICY "job_images_delete" ON public.job_images FOR DELETE USING (uploaded_by = auth.uid() OR public.is_staff())';
  END IF;
END $$;

-- ============================================================
-- 26. work_instruction_templates (optional — table may not exist yet)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'work_instruction_templates') THEN
    EXECUTE 'CREATE POLICY "wit_select" ON public.work_instruction_templates FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "wit_insert_staff" ON public.work_instruction_templates FOR INSERT WITH CHECK (public.is_staff())';
    EXECUTE 'CREATE POLICY "wit_update_staff" ON public.work_instruction_templates FOR UPDATE USING (public.is_staff())';
  END IF;
END $$;

-- ============================================================
-- 27. job_safety_checks (optional — table may not exist yet)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'job_safety_checks') THEN
    EXECUTE 'CREATE POLICY "safety_select" ON public.job_safety_checks FOR SELECT USING (checked_by = auth.uid() OR public.is_staff())';
    EXECUTE 'CREATE POLICY "safety_insert" ON public.job_safety_checks FOR INSERT WITH CHECK (checked_by = auth.uid())';
  END IF;
END $$;

-- ============================================================
-- 28. credential_level_config (optional — table may not exist yet)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credential_level_config') THEN
    EXECUTE 'CREATE POLICY "clc_select" ON public.credential_level_config FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "clc_update_admin" ON public.credential_level_config FOR UPDATE USING (public.is_admin())';
  END IF;
END $$;

-- ============================================================
-- 29. training_courses — public read, staff manage
-- ============================================================
CREATE POLICY "courses_select" ON public.training_courses FOR SELECT
  USING (true);

CREATE POLICY "courses_insert_staff" ON public.training_courses FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "courses_update_staff" ON public.training_courses FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 30. training_modules — public read, staff manage
-- ============================================================
CREATE POLICY "modules_select" ON public.training_modules FOR SELECT
  USING (true);

CREATE POLICY "modules_insert_staff" ON public.training_modules FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "modules_update_staff" ON public.training_modules FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 31. training_enrollments
-- ============================================================
CREATE POLICY "enrollments_select" ON public.training_enrollments FOR SELECT
  USING (trainee_id = auth.uid() OR public.is_staff());

CREATE POLICY "enrollments_insert" ON public.training_enrollments FOR INSERT
  WITH CHECK (trainee_id = auth.uid());

CREATE POLICY "enrollments_update_staff" ON public.training_enrollments FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- 32. module_assessments
-- ============================================================
CREATE POLICY "assessments_select" ON public.module_assessments FOR SELECT
  USING (
    assessor_id = auth.uid()
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.training_enrollments te
      WHERE te.id = enrollment_id AND te.trainee_id = auth.uid()
    )
  );

CREATE POLICY "assessments_insert_staff" ON public.module_assessments FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "assessments_update_staff" ON public.module_assessments FOR UPDATE
  USING (public.is_staff());

-- ============================================================
-- DONE — verify with: SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- ============================================================
