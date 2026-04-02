-- ==========================================
-- SkillChain RMUTL - Credential Level System
-- + Evaluation Windows + On-chain Hash
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==================== Credential Level (5 ระดับ) ====================

CREATE TYPE "CredentialLevel" AS ENUM (
  'LEVEL_1',  -- Registered (ลงทะเบียน ยังรับงานไม่ได้)
  'LEVEL_2',  -- Project Certified (ใต้ร่มพระบารมี ฝึกทักษะ+จิตอาสา)
  'LEVEL_3',  -- Teacher Certified (อาจารย์ มทร.ล้านนา)
  'LEVEL_4',  -- National Certified (กรมพัฒนาฝีมือแรงงาน/สคช.)
  'LEVEL_5'   -- Master Technician (รับเหมา+สอนงาน+รับรองผู้อื่น)
);

CREATE TYPE "CertifyingBody" AS ENUM (
  'SYSTEM',           -- ระบบอัตโนมัติ (ลงทะเบียน)
  'PROJECT_BARAMEE',  -- กลุ่มใต้ร่มพระบารมี
  'RMUTL_TEACHER',    -- อาจารย์ มทร.ล้านนา
  'DSD',              -- กรมพัฒนาฝีมือแรงงาน
  'TPQI',             -- สถาบันคุณวุฒิวิชาชีพ
  'MASTER_TECH'       -- Master Technician (Lv.5 รับรอง Lv.1→2)
);

CREATE TYPE "EvalPhase" AS ENUM (
  'PRE_WORK',    -- ก่อนเริ่มงาน (Mentor ประเมินความพร้อม)
  'IN_PROGRESS', -- ระหว่างทำงาน (Mentor บันทึก progress)
  'POST_WORK'    -- หลังงานเสร็จ (ทุกฝ่ายประเมินผล)
);

-- ==================== Student Credentials ====================

CREATE TABLE student_credentials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES users(id),
  credential_level    "CredentialLevel" NOT NULL DEFAULT 'LEVEL_1',
  certified_by        "CertifyingBody" NOT NULL DEFAULT 'SYSTEM',
  certified_by_user_id UUID REFERENCES users(id),  -- ใครเป็นคนรับรอง
  certificate_ref     TEXT,          -- เลขที่ใบรับรอง (จาก กรมฝีมือแรงงาน / สคช.)
  specialization      TEXT,          -- สาขาเฉพาะทาง เช่น "ไฟฟ้าภายในอาคาร ระดับ 1"
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,   -- วันหมดอายุ (ถ้ามี)
  nft_tx_hash         TEXT,          -- on-chain proof
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_credentials_student ON student_credentials(student_id);
CREATE INDEX idx_student_credentials_level ON student_credentials(credential_level);

-- Current active credential per student (highest level)
CREATE OR REPLACE VIEW student_current_credential AS
SELECT DISTINCT ON (student_id)
  student_id,
  credential_level,
  certified_by,
  certificate_ref,
  specialization,
  issued_at,
  expires_at,
  nft_tx_hash
FROM student_credentials
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY student_id, credential_level DESC, issued_at DESC;

-- ==================== Evaluation Windows ====================

-- เพิ่ม columns ใน jobs สำหรับ evaluation window
ALTER TABLE jobs ADD COLUMN eval_window_start TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN eval_window_end TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN eval_window_days INTEGER NOT NULL DEFAULT 7;

-- Auto-set evaluation window เมื่องาน completed
CREATE OR REPLACE FUNCTION set_eval_window()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    NEW.eval_window_start = now();
    NEW.eval_window_end = now() + (NEW.eval_window_days || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_eval_window
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_eval_window();

-- ==================== On-chain Hash for Evaluations ====================

-- เพิ่ม on-chain hash + eval_phase ในทุก review table
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS content_hash TEXT;  -- SHA-256 ของเนื้อหาประเมิน

ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- ==================== Job Access Control Function ====================

-- ฟังก์ชันตรวจสอบสิทธิ์รับงาน
CREATE OR REPLACE FUNCTION check_job_eligibility(
  p_student_id UUID,
  p_job_type "JobType",
  p_is_mentorship BOOLEAN DEFAULT false
) RETURNS TABLE(
  eligible BOOLEAN,
  reason TEXT,
  credential_level "CredentialLevel",
  requires_mentor BOOLEAN
) AS $$
DECLARE
  v_level "CredentialLevel";
BEGIN
  -- หา credential level สูงสุดที่ active
  SELECT sc.credential_level INTO v_level
  FROM student_credentials sc
  WHERE sc.student_id = p_student_id
    AND sc.is_active = true
    AND (sc.expires_at IS NULL OR sc.expires_at > now())
  ORDER BY sc.credential_level DESC
  LIMIT 1;

  -- ถ้าไม่มี credential เลย = LEVEL_1 (registered)
  IF v_level IS NULL THEN
    v_level := 'LEVEL_1';
  END IF;

  -- ตรวจสอบตามประเภทงาน
  CASE p_job_type
    WHEN 'TRAINING' THEN
      IF v_level >= 'LEVEL_2' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level,
          (v_level = 'LEVEL_2' AND NOT p_is_mentorship);
      ELSE
        RETURN QUERY SELECT false,
          'ต้องมี credential ระดับ 2 ขึ้นไป (ผ่านการฝึกอบรมจากกลุ่มใต้ร่มพระบารมี)'::TEXT,
          v_level, true;
      END IF;

    WHEN 'VOLUNTEER' THEN
      IF v_level >= 'LEVEL_2' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level,
          (v_level = 'LEVEL_2' AND NOT p_is_mentorship);
      ELSE
        RETURN QUERY SELECT false,
          'ต้องมี credential ระดับ 2 ขึ้นไป'::TEXT, v_level, true;
      END IF;

    WHEN 'PAID' THEN
      IF v_level >= 'LEVEL_3' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level, false;
      ELSE
        RETURN QUERY SELECT false,
          'ต้องมี credential ระดับ 3 ขึ้นไป (อาจารย์รับรอง)'::TEXT, v_level, false;
      END IF;

    WHEN 'EXEMPTED' THEN
      IF v_level >= 'LEVEL_3' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level, false;
      ELSE
        RETURN QUERY SELECT false,
          'ต้องมี credential ระดับ 3 ขึ้นไป'::TEXT, v_level, false;
      END IF;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ==================== Credential Level Descriptions ====================

CREATE TABLE credential_level_config (
  level           "CredentialLevel" PRIMARY KEY,
  level_number    INTEGER NOT NULL,
  name_en         TEXT NOT NULL,
  name_th         TEXT NOT NULL,
  description_th  TEXT NOT NULL,
  certified_by_th TEXT NOT NULL,
  nft_tier        TEXT NOT NULL,
  can_mentor      BOOLEAN NOT NULL DEFAULT false,
  can_contract    BOOLEAN NOT NULL DEFAULT false,
  can_certify_others BOOLEAN NOT NULL DEFAULT false,
  allowed_job_types "JobType"[] NOT NULL DEFAULT '{}'
);

INSERT INTO credential_level_config VALUES
  ('LEVEL_1', 1, 'Registered', 'ลงทะเบียน',
   'ลงทะเบียนเข้าระบบแล้ว กำลังเรียนรู้ สังเกตการณ์ได้',
   'ระบบอัตโนมัติ', 'none',
   false, false, false, '{}'),

  ('LEVEL_2', 2, 'Project Certified', 'ผ่านฝึกอบรมโครงการ',
   'ผ่านฝึกอบรมเบื้องต้นจากกลุ่มใต้ร่มพระบารมี รับงานฝึกทักษะ+จิตอาสาได้ (ต้องมี Mentor)',
   'กลุ่มใต้ร่มพระบารมี', 'bronze',
   false, false, false, '{TRAINING,VOLUNTEER}'),

  ('LEVEL_3', 3, 'Teacher Certified', 'อาจารย์รับรอง',
   'อาจารย์ที่ปรึกษา มทร.ล้านนา ประเมินผ่าน รับงานจ้างได้',
   'อาจารย์ มทร.ล้านนา', 'silver',
   false, false, false, '{TRAINING,VOLUNTEER,PAID,EXEMPTED}'),

  ('LEVEL_4', 4, 'National Certified', 'สถาบันระดับชาติรับรอง',
   'ใบรับรองจากกรมพัฒนาฝีมือแรงงาน หรือ สคช. รับงานได้ทุกประเภท+เป็น Mentor ได้',
   'กรมพัฒนาฝีมือแรงงาน / สคช.', 'gold',
   true, false, false, '{TRAINING,VOLUNTEER,PAID,EXEMPTED}'),

  ('LEVEL_5', 5, 'Master Technician', 'ช่างชำนาญการ',
   'รับเหมางานเองได้ สอนงานและรับรองผู้อื่นระดับ 1→2 ได้',
   'กรมพัฒนาฝีมือแรงงาน + ผลงานสะสม', 'diamond',
   true, true, true, '{TRAINING,VOLUNTEER,PAID,EXEMPTED}');

-- ==================== Update student_rating_summary view ====================

DROP VIEW IF EXISTS student_rating_summary;
CREATE OR REPLACE VIEW student_rating_summary AS
SELECT
  u.id AS student_id,
  u.name,
  u.campus,
  -- Credential
  COALESCE(sc.credential_level, 'LEVEL_1') AS credential_level,
  clc.name_th AS credential_name,
  clc.nft_tier,
  -- จาก Evaluation (อาจารย์)
  COALESCE(te.avg_teacher_score, 0) AS avg_teacher_score,
  COALESCE(te.teacher_review_count, 0) AS teacher_review_count,
  -- จาก Employer Review
  COALESCE(er.avg_employer_rating, 0) AS avg_employer_rating,
  COALESCE(er.employer_review_count, 0) AS employer_review_count,
  -- จาก Mentor Review
  COALESCE(mr.avg_mentor_score, 0) AS avg_mentor_score,
  COALESCE(mr.mentor_review_count, 0) AS mentor_review_count,
  -- Overall weighted
  ROUND(CAST(
    (COALESCE(te.avg_teacher_score, 0) * 0.4 +
     COALESCE(er.avg_employer_rating, 0) * 0.35 +
     COALESCE(mr.avg_mentor_score, 0) * 0.25)
    / GREATEST(
      (CASE WHEN te.avg_teacher_score > 0 THEN 0.4 ELSE 0 END) +
      (CASE WHEN er.avg_employer_rating > 0 THEN 0.35 ELSE 0 END) +
      (CASE WHEN mr.avg_mentor_score > 0 THEN 0.25 ELSE 0 END),
      0.01
    ) AS NUMERIC), 2) AS combined_score
FROM users u
LEFT JOIN (
  SELECT DISTINCT ON (student_id) student_id, credential_level
  FROM student_credentials
  WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
  ORDER BY student_id, credential_level DESC
) sc ON sc.student_id = u.id
LEFT JOIN credential_level_config clc ON clc.level = COALESCE(sc.credential_level, 'LEVEL_1')
LEFT JOIN (
  SELECT student_id,
    ROUND(AVG(weighted_score)::NUMERIC, 2) AS avg_teacher_score,
    COUNT(*) AS teacher_review_count
  FROM evaluations GROUP BY student_id
) te ON te.student_id = u.id
LEFT JOIN (
  SELECT student_id,
    ROUND(AVG(overall_rating)::NUMERIC, 2) AS avg_employer_rating,
    COUNT(*) AS employer_review_count
  FROM employer_reviews GROUP BY student_id
) er ON er.student_id = u.id
LEFT JOIN (
  SELECT trainee_id,
    ROUND(AVG(weighted_score)::NUMERIC, 2) AS avg_mentor_score,
    COUNT(*) AS mentor_review_count
  FROM mentor_reviews GROUP BY trainee_id
) mr ON mr.trainee_id = u.id
WHERE u.role = 'student';
