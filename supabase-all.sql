-- ==========================================
-- SkillChain RMUTL - COMPLETE Database Setup
-- รวมทุกอย่าง: reviews + credential + eval windows
-- ปลอดภัย: รันซ้ำได้ไม่พัง
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==================== ENUMS (ข้ามถ้ามีแล้ว) ====================
DO $$ BEGIN CREATE TYPE "EvalPhase" AS ENUM ('PRE_WORK','IN_PROGRESS','POST_WORK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CredentialLevel" AS ENUM ('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CertifyingBody" AS ENUM ('SYSTEM','PROJECT_BARAMEE','RMUTL_TEACHER','DSD','TPQI','MASTER_TECH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==================== REVIEW TABLES (ข้ามถ้ามีแล้ว) ====================

CREATE TABLE IF NOT EXISTS employer_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  employer_id     UUID NOT NULL REFERENCES users(id),
  student_id      UUID NOT NULL REFERENCES users(id),
  score_quality   INTEGER NOT NULL CHECK (score_quality BETWEEN 1 AND 5),
  score_punctuality INTEGER NOT NULL CHECK (score_punctuality BETWEEN 1 AND 5),
  score_attitude  INTEGER NOT NULL CHECK (score_attitude BETWEEN 1 AND 5),
  overall_rating  DOUBLE PRECISION NOT NULL,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, employer_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_employer_reviews_student ON employer_reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_employer_reviews_employer ON employer_reviews(employer_id);

CREATE TABLE IF NOT EXISTS student_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  student_id      UUID NOT NULL REFERENCES users(id),
  employer_id     UUID NOT NULL REFERENCES users(id),
  score_clarity   INTEGER NOT NULL CHECK (score_clarity BETWEEN 1 AND 5),
  score_payment   INTEGER NOT NULL CHECK (score_payment BETWEEN 1 AND 5),
  score_safety    INTEGER NOT NULL CHECK (score_safety BETWEEN 1 AND 5),
  overall_rating  DOUBLE PRECISION NOT NULL,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, student_id, employer_id)
);
CREATE INDEX IF NOT EXISTS idx_student_reviews_employer ON student_reviews(employer_id);
CREATE INDEX IF NOT EXISTS idx_student_reviews_student ON student_reviews(student_id);

CREATE TABLE IF NOT EXISTS mentor_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  mentor_id       UUID NOT NULL REFERENCES users(id),
  trainee_id      UUID NOT NULL REFERENCES users(id),
  score_effort    INTEGER NOT NULL CHECK (score_effort BETWEEN 1 AND 4),
  score_safety    INTEGER NOT NULL CHECK (score_safety BETWEEN 1 AND 4),
  score_skill_dev INTEGER NOT NULL CHECK (score_skill_dev BETWEEN 1 AND 4),
  weighted_score  DOUBLE PRECISION NOT NULL,
  comment         TEXT,
  recommend_promotion BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, mentor_id, trainee_id)
);
CREATE INDEX IF NOT EXISTS idx_mentor_reviews_trainee ON mentor_reviews(trainee_id);
CREATE INDEX IF NOT EXISTS idx_mentor_reviews_mentor ON mentor_reviews(mentor_id);

-- ==================== ADD COLUMNS (eval_phase, on-chain) ====================

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- ==================== CREDENTIAL SYSTEM ====================

CREATE TABLE IF NOT EXISTS student_credentials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES users(id),
  credential_level    "CredentialLevel" NOT NULL DEFAULT 'LEVEL_1',
  certified_by        "CertifyingBody" NOT NULL DEFAULT 'SYSTEM',
  certified_by_user_id UUID REFERENCES users(id),
  certificate_ref     TEXT,
  specialization      TEXT,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  nft_tx_hash         TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_credentials_student ON student_credentials(student_id);
CREATE INDEX IF NOT EXISTS idx_student_credentials_level ON student_credentials(credential_level);

CREATE TABLE IF NOT EXISTS credential_level_config (
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
   'ระบบอัตโนมัติ', 'none', false, false, false, '{}'),
  ('LEVEL_2', 2, 'Project Certified', 'ผ่านฝึกอบรมโครงการ',
   'ผ่านฝึกอบรมเบื้องต้นจากกลุ่มใต้ร่มพระบารมี รับงานฝึกทักษะ+จิตอาสาได้ (ต้องมี Mentor)',
   'กลุ่มใต้ร่มพระบารมี', 'bronze', false, false, false, '{TRAINING,VOLUNTEER}'),
  ('LEVEL_3', 3, 'Teacher Certified', 'อาจารย์รับรอง',
   'อาจารย์ที่ปรึกษา มทร.ล้านนา ประเมินผ่าน รับงานจ้างได้',
   'อาจารย์ มทร.ล้านนา', 'silver', false, false, false, '{TRAINING,VOLUNTEER,PAID,EXEMPTED}'),
  ('LEVEL_4', 4, 'National Certified', 'สถาบันระดับชาติรับรอง',
   'ใบรับรองจากกรมพัฒนาฝีมือแรงงาน หรือ สคช. รับงานได้ทุกประเภท+เป็น Mentor ได้',
   'กรมพัฒนาฝีมือแรงงาน / สคช.', 'gold', true, false, false, '{TRAINING,VOLUNTEER,PAID,EXEMPTED}'),
  ('LEVEL_5', 5, 'Master Technician', 'ช่างชำนาญการ',
   'รับเหมางานเองได้ สอนงานและรับรองผู้อื่นระดับ 1→2 ได้',
   'กรมพัฒนาฝีมือแรงงาน + ผลงานสะสม', 'diamond', true, true, true, '{TRAINING,VOLUNTEER,PAID,EXEMPTED}')
ON CONFLICT (level) DO NOTHING;

-- ==================== EVALUATION WINDOWS ====================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eval_window_start TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eval_window_end TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eval_window_days INTEGER NOT NULL DEFAULT 7;

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

DROP TRIGGER IF EXISTS trigger_set_eval_window ON jobs;
CREATE TRIGGER trigger_set_eval_window
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_eval_window();

-- ==================== JOB ELIGIBILITY FUNCTION ====================

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
  SELECT sc.credential_level INTO v_level
  FROM student_credentials sc
  WHERE sc.student_id = p_student_id
    AND sc.is_active = true
    AND (sc.expires_at IS NULL OR sc.expires_at > now())
  ORDER BY sc.credential_level DESC
  LIMIT 1;

  IF v_level IS NULL THEN v_level := 'LEVEL_1'; END IF;

  CASE p_job_type
    WHEN 'TRAINING' THEN
      IF v_level >= 'LEVEL_2' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level, (v_level = 'LEVEL_2' AND NOT p_is_mentorship);
      ELSE
        RETURN QUERY SELECT false, 'ต้องมี credential ระดับ 2 ขึ้นไป'::TEXT, v_level, true;
      END IF;
    WHEN 'VOLUNTEER' THEN
      IF v_level >= 'LEVEL_2' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level, (v_level = 'LEVEL_2' AND NOT p_is_mentorship);
      ELSE
        RETURN QUERY SELECT false, 'ต้องมี credential ระดับ 2 ขึ้นไป'::TEXT, v_level, true;
      END IF;
    WHEN 'PAID' THEN
      IF v_level >= 'LEVEL_3' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level, false;
      ELSE
        RETURN QUERY SELECT false, 'ต้องมี credential ระดับ 3 ขึ้นไป (อาจารย์รับรอง)'::TEXT, v_level, false;
      END IF;
    WHEN 'EXEMPTED' THEN
      IF v_level >= 'LEVEL_3' THEN
        RETURN QUERY SELECT true, 'ผ่าน'::TEXT, v_level, false;
      ELSE
        RETURN QUERY SELECT false, 'ต้องมี credential ระดับ 3 ขึ้นไป'::TEXT, v_level, false;
      END IF;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ==================== VIEWS ====================

DROP VIEW IF EXISTS student_current_credential;
CREATE VIEW student_current_credential AS
SELECT DISTINCT ON (student_id)
  student_id, credential_level, certified_by, certificate_ref,
  specialization, issued_at, expires_at, nft_tx_hash
FROM student_credentials
WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
ORDER BY student_id, credential_level DESC, issued_at DESC;

DROP VIEW IF EXISTS student_rating_summary;
CREATE VIEW student_rating_summary AS
SELECT
  u.id AS student_id, u.name, u.campus,
  COALESCE(sc.credential_level, 'LEVEL_1') AS credential_level,
  clc.name_th AS credential_name, clc.nft_tier,
  COALESCE(te.avg_teacher_score, 0) AS avg_teacher_score,
  COALESCE(te.teacher_review_count, 0) AS teacher_review_count,
  COALESCE(er.avg_employer_rating, 0) AS avg_employer_rating,
  COALESCE(er.employer_review_count, 0) AS employer_review_count,
  COALESCE(mr.avg_mentor_score, 0) AS avg_mentor_score,
  COALESCE(mr.mentor_review_count, 0) AS mentor_review_count,
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
  SELECT student_id, ROUND(AVG(weighted_score)::NUMERIC, 2) AS avg_teacher_score, COUNT(*) AS teacher_review_count
  FROM evaluations GROUP BY student_id
) te ON te.student_id = u.id
LEFT JOIN (
  SELECT student_id, ROUND(AVG(overall_rating)::NUMERIC, 2) AS avg_employer_rating, COUNT(*) AS employer_review_count
  FROM employer_reviews GROUP BY student_id
) er ON er.student_id = u.id
LEFT JOIN (
  SELECT trainee_id, ROUND(AVG(weighted_score)::NUMERIC, 2) AS avg_mentor_score, COUNT(*) AS mentor_review_count
  FROM mentor_reviews GROUP BY trainee_id
) mr ON mr.trainee_id = u.id
WHERE u.role = 'student';

DROP VIEW IF EXISTS employer_rating_summary;
CREATE VIEW employer_rating_summary AS
SELECT
  u.id AS employer_id, u.name,
  ROUND(COALESCE(AVG(sr.overall_rating), 0)::NUMERIC, 2) AS avg_rating,
  COALESCE(COUNT(sr.id), 0) AS review_count,
  ROUND(COALESCE(AVG(sr.score_clarity), 0)::NUMERIC, 2) AS avg_clarity,
  ROUND(COALESCE(AVG(sr.score_payment), 0)::NUMERIC, 2) AS avg_payment,
  ROUND(COALESCE(AVG(sr.score_safety), 0)::NUMERIC, 2) AS avg_safety
FROM users u
LEFT JOIN student_reviews sr ON sr.employer_id = u.id
WHERE u.role = 'employer'
GROUP BY u.id, u.name;
