-- ==========================================
-- SkillChain RMUTL - New Roles + Approval System
-- + Job-specific review validation
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==================== เพิ่ม Role ใหม่ ====================
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'project_staff';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'rmutl_staff';

-- ==================== Approval Status ====================
DO $$ BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==================== เพิ่ม columns ใน users ====================
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ข้อมูลเพิ่มเติมตาม role
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_card TEXT;     -- รหัสนักศึกษา
ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty TEXT;             -- คณะ/สาขา
ALTER TABLE users ADD COLUMN IF NOT EXISTS year_level INTEGER;       -- ชั้นปี
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization TEXT;        -- ชื่อหน่วยงาน/บริษัท
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_registration TEXT;    -- เลขทะเบียน/เลขผู้เสียภาษี
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_address TEXT;         -- ที่อยู่หน่วยงาน
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_position TEXT;      -- ตำแหน่ง (staff roles)
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_id_card TEXT;     -- รหัสอาจารย์

-- อัปเดต user ที่มีอยู่แล้วให้เป็น APPROVED (ไม่งั้นจะ login ไม่ได้)
UPDATE users SET approval_status = 'APPROVED' WHERE approval_status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_users_approval ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==================== Approval Log ====================
CREATE TABLE IF NOT EXISTS approval_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),     -- ผู้ถูกยืนยัน
  approved_by  UUID NOT NULL REFERENCES users(id),     -- ผู้ยืนยัน
  action       "ApprovalStatus" NOT NULL,               -- APPROVED / REJECTED / SUSPENDED
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_logs_user ON approval_logs(user_id);

-- ==================== Job-specific Review Validation ====================

-- ฟังก์ชันตรวจสอบว่า reviewer เกี่ยวข้องกับงานจริง
CREATE OR REPLACE FUNCTION check_review_eligibility(
  p_reviewer_id UUID,
  p_job_id UUID,
  p_review_type TEXT  -- 'teacher', 'employer', 'student', 'mentor'
) RETURNS TABLE(eligible BOOLEAN, reason TEXT) AS $$
DECLARE
  v_job RECORD;
  v_reviewer RECORD;
BEGIN
  -- ดึงข้อมูลงาน
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RETURN QUERY SELECT false, 'ไม่พบงานนี้'::TEXT;
    RETURN;
  END IF;

  -- ดึงข้อมูล reviewer
  SELECT * INTO v_reviewer FROM users WHERE id = p_reviewer_id;

  CASE p_review_type
    -- อาจารย์/rmutl_staff ประเมิน: ต้องเป็น teacher หรือ rmutl_staff/project_staff/admin
    WHEN 'teacher' THEN
      IF v_reviewer.role IN ('teacher', 'rmutl_staff', 'project_staff', 'admin', 'superadmin') THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT;
      ELSE
        RETURN QUERY SELECT false, 'เฉพาะอาจารย์/คณะทำงานเท่านั้น'::TEXT;
      END IF;

    -- ผู้จ้างให้ดาว นศ.: ต้องเป็นเจ้าของงาน
    WHEN 'employer' THEN
      IF v_job.employer_id = p_reviewer_id THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT;
      ELSE
        RETURN QUERY SELECT false, 'เฉพาะผู้ว่าจ้างของงานนี้เท่านั้น'::TEXT;
      END IF;

    -- นศ.ให้ดาวผู้จ้าง: ต้องเป็น นศ.ที่ทำงานนี้
    WHEN 'student' THEN
      IF v_job.student_id = p_reviewer_id THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT;
      ELSE
        RETURN QUERY SELECT false, 'เฉพาะนักศึกษาที่ทำงานนี้เท่านั้น'::TEXT;
      END IF;

    -- Mentor ประเมิน Trainee: ต้องเป็น mentor ของงานนี้
    WHEN 'mentor' THEN
      IF v_job.mentor_id = p_reviewer_id THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT;
      ELSE
        RETURN QUERY SELECT false, 'เฉพาะพี่เลี้ยงของงานนี้เท่านั้น'::TEXT;
      END IF;
  END CASE;
END;
$$ LANGUAGE plpgsql;
