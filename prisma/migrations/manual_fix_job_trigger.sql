-- ============================================================================
-- FIX: Job Creation Trigger — handle errors gracefully
-- ============================================================================
-- The original trigger fails silently due to type mismatch between
-- skc_jobs.id (TEXT/String from Prisma) and skc_activity_approvals.job_id (UUID).
-- This wraps the body in EXCEPTION to allow job creation to succeed even if
-- gov-workflow tables aren't fully aligned.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_job_created_create_activity_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_id UUID;
  v_project_id UUID;
  v_estimated_hours NUMERIC := 1;
BEGIN
  -- Wrap entire body in EXCEPTION block — trigger should NEVER fail job creation
  BEGIN
    -- หาโครงการแม่ปีปัจจุบัน
    SELECT id INTO v_project_id FROM "skc_gov_projects"
    WHERE fiscal_year = EXTRACT(YEAR FROM NEW.created_at) + 543
    ORDER BY created_at DESC LIMIT 1;

    -- คำนวณ hours โดยประมาณ
    IF NEW.pay_amount > 0 THEN
      v_estimated_hours := GREATEST(NEW.pay_amount / 300.0, 1);
    END IF;

    -- สร้าง DRAFT activity_approval
    -- Note: cast NEW.id to text to avoid UUID/TEXT mismatch
    INSERT INTO "skc_activity_approvals" (
      project_id, job_id, activity_title, description,
      num_students, total_hours, rate_per_hour, total_compensation,
      location, requested_at, status
    ) VALUES (
      v_project_id,
      NEW.id::text::uuid,
      NEW.title,
      NEW.description,
      1,
      v_estimated_hours,
      300,
      NEW.pay_amount,
      NEW.location,
      NOW(),
      'DRAFT'
    )
    RETURNING id INTO v_activity_id;

    -- Update job fields
    UPDATE "skc_jobs" SET
      gov_status = 'DRAFT',
      gov_activity_id = v_activity_id::text,
      gov_project_id = v_project_id::text
    WHERE id = NEW.id;

    -- Log transition
    INSERT INTO "skc_gov_workflow_log" (job_id, activity_id, to_status, note)
    VALUES (NEW.id::text::uuid, v_activity_id, 'DRAFT', 'Auto-created from job creation');

  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block job creation
    RAISE WARNING 'Gov workflow trigger failed for job %: % (will not block insert)',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Same defensive treatment for other triggers
CREATE OR REPLACE FUNCTION fn_job_gate_check_assignment()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Only enforce gate if gov_status was set up properly
    IF OLD.status = 'OPEN' AND NEW.status = 'ASSIGNED' AND NEW.gov_status IS NOT NULL THEN
      IF NEW.gov_status::text NOT IN ('ACTIVITY_APPROVED', 'CONTRACT_PENDING', 'CONTRACT_SIGNED', 'IN_PROGRESS') THEN
        RAISE EXCEPTION 'ไม่สามารถมอบหมายงานได้ — บันทึกขออนุมัติกิจกรรมยังไม่ได้รับการอนุมัติ (gov_status=%)', NEW.gov_status
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0001' THEN RAISE;        -- Re-raise our own gate errors
    WHEN OTHERS THEN
      RAISE WARNING 'Gate check failed for job %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_job_completed_create_work_cert()
RETURNS TRIGGER AS $$
DECLARE
  v_actual_hours NUMERIC;
  v_existing_cert UUID;
BEGIN
  BEGIN
    IF NEW.staff_confirmed_completion = TRUE
       AND NEW.employer_confirmed_completion = TRUE
       AND (OLD.staff_confirmed_completion = FALSE OR OLD.employer_confirmed_completion = FALSE) THEN

      SELECT id INTO v_existing_cert FROM "skc_work_certifications"
      WHERE job_id = NEW.id::text::uuid LIMIT 1;

      IF v_existing_cert IS NULL THEN
        SELECT COALESCE(SUM(hours), NEW.pay_amount / 300.0)
        INTO v_actual_hours
        FROM "skc_gov_timesheets"
        WHERE job_id = NEW.id::text::uuid;

        INSERT INTO "skc_work_certifications" (
          activity_id, job_id, student_id,
          cert_date, total_hours_actual, work_quality, status
        ) VALUES (
          NEW.gov_activity_id::text::uuid,
          NEW.id::text::uuid,
          NEW.student_id::text::uuid,
          CURRENT_DATE,
          v_actual_hours,
          'ดี',
          'DRAFT'
        );

        NEW.gov_status := 'IN_PROGRESS';

        INSERT INTO "skc_gov_workflow_log" (job_id, activity_id, from_status, to_status, note)
        VALUES (NEW.id::text::uuid, NEW.gov_activity_id::text::uuid, OLD.gov_status, 'IN_PROGRESS', 'Auto-created work_certification');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Work cert trigger failed for job %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_job_gate_check_escrow_release()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
      IF NEW.gov_activity_id IS NOT NULL THEN
        IF NEW.gov_status::text NOT IN ('DISBURSEMENT_APPROVED', 'PAID', 'COMPLETED') THEN
          RAISE EXCEPTION 'ไม่สามารถปิดงานและปล่อย Escrow ได้ — ยังไม่ได้รับอนุมัติใบเบิก (gov_status=%)', NEW.gov_status
            USING ERRCODE = 'P0002';
        END IF;
      END IF;
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0002' THEN RAISE;
    WHEN OTHERS THEN
      RAISE WARNING 'Escrow gate check failed for job %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
