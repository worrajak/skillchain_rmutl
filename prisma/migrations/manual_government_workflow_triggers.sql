-- ============================================================================
-- Government Workflow Triggers — Bidirectional Sync
-- ============================================================================
-- เชื่อม Blockchain track (skc_jobs.status) ↔ Government track (skc_jobs.gov_status)
-- อัตโนมัติเมื่อมีเหตุการณ์ต่างๆ เกิดขึ้นในตาราง skc_jobs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger 1: auto-create activity_approval เมื่อ Job ถูกสร้างใหม่
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_job_created_create_activity_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_id UUID;
  v_project_id UUID;
  v_num_students INTEGER := 1;
  v_estimated_hours NUMERIC := 1;
BEGIN
  -- หาโครงการแม่ปีปัจจุบัน (default ถ้ามี)
  SELECT id INTO v_project_id FROM "skc_gov_projects"
  WHERE fiscal_year = EXTRACT(YEAR FROM NEW.created_at) + 543  -- พ.ศ.
  ORDER BY created_at DESC LIMIT 1;

  -- คำนวณ hours โดยประมาณจาก pay_amount ÷ 300 (rate per job = 300 บาท)
  IF NEW.pay_amount > 0 THEN
    v_estimated_hours := GREATEST(NEW.pay_amount / 300.0, 1);
  END IF;

  -- สร้าง DRAFT activity_approval
  INSERT INTO "skc_activity_approvals" (
    project_id, job_id, activity_title, description,
    num_students, total_hours, rate_per_hour, total_compensation,
    location, requested_at, status
  ) VALUES (
    v_project_id,
    NEW.id,
    NEW.title,
    NEW.description,
    v_num_students,
    v_estimated_hours,
    300,                                    -- อัตรามาตรฐาน (ปรับตามระเบียบ ม.)
    NEW.pay_amount,
    NEW.location,
    NOW(),
    'DRAFT'
  )
  RETURNING id INTO v_activity_id;

  -- Update job fields
  UPDATE "skc_jobs" SET
    gov_status = 'DRAFT',
    gov_activity_id = v_activity_id,
    gov_project_id = v_project_id
  WHERE id = NEW.id;

  -- Log transition
  INSERT INTO "skc_gov_workflow_log" (job_id, activity_id, to_status, note)
  VALUES (NEW.id, v_activity_id, 'DRAFT', 'Auto-created from job creation');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_created ON "skc_jobs";
CREATE TRIGGER trg_job_created
  AFTER INSERT ON "skc_jobs"
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_created_create_activity_approval();

-- ----------------------------------------------------------------------------
-- Trigger 2: Gate Check — ห้าม ASSIGN ถ้า gov_status ยังไม่ผ่าน ACTIVITY_APPROVED
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_job_gate_check_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้าเปลี่ยนจาก OPEN → ASSIGNED ต้องได้อนุมัติกิจกรรมแล้ว
  IF OLD.status = 'OPEN' AND NEW.status = 'ASSIGNED' THEN
    IF NEW.gov_status NOT IN ('ACTIVITY_APPROVED', 'CONTRACT_PENDING', 'CONTRACT_SIGNED', 'IN_PROGRESS') THEN
      RAISE EXCEPTION 'ไม่สามารถมอบหมายงานได้ — บันทึกขออนุมัติกิจกรรมยังไม่ได้รับการอนุมัติ (gov_status=%)', NEW.gov_status
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_gate_assignment ON "skc_jobs";
CREATE TRIGGER trg_job_gate_assignment
  BEFORE UPDATE OF status ON "skc_jobs"
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_gate_check_assignment();

-- ----------------------------------------------------------------------------
-- Trigger 3: Auto-create work_certification เมื่องานเสร็จ
-- (เมื่อ both staff + employer confirm completion)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_job_completed_create_work_cert()
RETURNS TRIGGER AS $$
DECLARE
  v_actual_hours NUMERIC;
  v_existing_cert UUID;
BEGIN
  -- ตรวจสอบว่า both staff + employer confirm แล้ว (เปลี่ยนจาก false → true)
  IF NEW.staff_confirmed_completion = TRUE
     AND NEW.employer_confirmed_completion = TRUE
     AND (OLD.staff_confirmed_completion = FALSE OR OLD.employer_confirmed_completion = FALSE) THEN

    -- ตรวจว่ามี cert แล้วหรือยัง (ป้องกัน duplicate)
    SELECT id INTO v_existing_cert FROM "skc_work_certifications"
    WHERE job_id = NEW.id LIMIT 1;

    IF v_existing_cert IS NULL THEN
      -- คำนวณชั่วโมงจริงจาก timesheets
      SELECT COALESCE(SUM(hours), NEW.pay_amount / 300.0)
      INTO v_actual_hours
      FROM "skc_gov_timesheets"
      WHERE job_id = NEW.id;

      -- สร้าง work_certification DRAFT
      INSERT INTO "skc_work_certifications" (
        activity_id, job_id, student_id,
        cert_date, total_hours_actual, work_quality,
        status
      ) VALUES (
        NEW.gov_activity_id, NEW.id, NEW.student_id,
        CURRENT_DATE,
        v_actual_hours,
        'ดี',  -- default ให้ staff แก้ไข
        'DRAFT'
      );

      -- Update gov_status
      NEW.gov_status := 'IN_PROGRESS';  -- รอ sign ครบ 3 ฝ่าย ถึงจะเป็น WORK_CERTIFIED

      -- Log
      INSERT INTO "skc_gov_workflow_log" (job_id, activity_id, from_status, to_status, note)
      VALUES (NEW.id, NEW.gov_activity_id, OLD.gov_status, 'IN_PROGRESS', 'Auto-created work_certification draft');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_completed ON "skc_jobs";
CREATE TRIGGER trg_job_completed
  BEFORE UPDATE OF staff_confirmed_completion, employer_confirmed_completion ON "skc_jobs"
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_completed_create_work_cert();

-- ----------------------------------------------------------------------------
-- Trigger 4: Gate Check — ห้ามปล่อย Escrow ถ้ายังไม่ผ่าน DISBURSEMENT_APPROVED
-- (ถ้าโครงการเลือกใช้เงินจริง ต้องรอเอกสารเบิกอนุมัติก่อน)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_job_gate_check_escrow_release()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้าเปลี่ยนจากมี escrow_tx → มี escrow_released_at (assuming escrow_tx has that pattern)
  -- หรือถ้ามี flag specific ใน table
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    -- ถ้าโครงการนี้ต้องผ่าน gov workflow (มี gov_activity_id)
    IF NEW.gov_activity_id IS NOT NULL THEN
      IF NEW.gov_status NOT IN ('DISBURSEMENT_APPROVED', 'PAID', 'COMPLETED') THEN
        RAISE EXCEPTION 'ไม่สามารถปิดงานและปล่อย Escrow ได้ — ยังไม่ได้รับอนุมัติใบเบิกจากฝ่ายการเงิน (gov_status=%)', NEW.gov_status
          USING ERRCODE = 'P0002';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_gate_escrow ON "skc_jobs";
CREATE TRIGGER trg_job_gate_escrow
  BEFORE UPDATE OF status ON "skc_jobs"
  FOR EACH ROW
  EXECUTE FUNCTION fn_job_gate_check_escrow_release();

-- ----------------------------------------------------------------------------
-- Trigger 5: Budget Counter — ตรวจสอบว่าไม่เกินโควต้า 100 ครั้ง × 300 บาท
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_check_project_budget_quota()
RETURNS TRIGGER AS $$
DECLARE
  v_project_budget NUMERIC;
  v_used_budget NUMERIC;
  v_new_total NUMERIC;
  v_job_count INTEGER;
BEGIN
  -- ดึง budget รวมของโครงการ
  IF NEW.project_id IS NOT NULL THEN
    SELECT total_budget, used_budget INTO v_project_budget, v_used_budget
    FROM "skc_gov_projects" WHERE id = NEW.project_id;

    v_new_total := COALESCE(v_used_budget, 0) + COALESCE(NEW.total_compensation, 0);

    IF v_new_total > v_project_budget AND v_project_budget > 0 THEN
      RAISE EXCEPTION 'งบประมาณโครงการเกินเพดาน: ใช้แล้ว % + ขอเพิ่ม % > งบ %',
        v_used_budget, NEW.total_compensation, v_project_budget
        USING ERRCODE = 'P0003';
    END IF;

    -- Count activity จำนวนครั้ง
    SELECT COUNT(*) INTO v_job_count FROM "skc_activity_approvals"
    WHERE project_id = NEW.project_id AND status IN ('APPROVED', 'SIGNED');

    -- เตือนถ้าเกิน 100 ครั้ง (soft limit)
    IF v_job_count >= 100 THEN
      RAISE WARNING 'โครงการนี้มีกิจกรรมอนุมัติแล้ว % ครั้ง ใกล้ถึงเพดาน 100 ครั้ง', v_job_count;
    END IF;

    -- Update used_budget
    UPDATE "skc_gov_projects"
    SET used_budget = v_new_total,
        updated_at = NOW()
    WHERE id = NEW.project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_budget_check ON "skc_activity_approvals";
CREATE TRIGGER trg_activity_budget_check
  BEFORE UPDATE OF status ON "skc_activity_approvals"
  FOR EACH ROW
  WHEN (NEW.status = 'APPROVED' AND OLD.status != 'APPROVED')
  EXECUTE FUNCTION fn_check_project_budget_quota();

-- ----------------------------------------------------------------------------
-- Helper Function: แปลง job status → gov status ที่ควรจะเป็น (auto-sync)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_sync_blockchain_to_gov()
RETURNS TRIGGER AS $$
BEGIN
  -- IN_PROGRESS จาก blockchain → ให้ gov_status เปลี่ยนด้วยถ้ายังเป็น CONTRACT_SIGNED
  IF NEW.status = 'IN_PROGRESS' AND OLD.status != 'IN_PROGRESS'
     AND NEW.gov_status = 'CONTRACT_SIGNED' THEN
    NEW.gov_status := 'IN_PROGRESS';

    INSERT INTO "skc_gov_workflow_log" (job_id, from_status, to_status, note)
    VALUES (NEW.id, 'CONTRACT_SIGNED', 'IN_PROGRESS', 'Auto-sync: blockchain IN_PROGRESS');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_blockchain_gov ON "skc_jobs";
CREATE TRIGGER trg_sync_blockchain_gov
  BEFORE UPDATE OF status ON "skc_jobs"
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_blockchain_to_gov();

-- ----------------------------------------------------------------------------
-- เปิดใช้งาน — ทดสอบ
-- ----------------------------------------------------------------------------
-- ทดสอบโดย: INSERT INTO skc_jobs (...) VALUES (...);
-- แล้วตรวจว่า skc_activity_approvals มีแถวใหม่อัตโนมัติ
