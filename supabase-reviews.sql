-- ==========================================
-- SkillChain RMUTL - Review & Rating System
-- Run this in Supabase SQL Editor
-- ==========================================

-- ==================== Employer reviews Student (Star 1-5 + Multi-criteria) ====================
CREATE TABLE employer_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  employer_id     UUID NOT NULL REFERENCES users(id),
  student_id      UUID NOT NULL REFERENCES users(id),
  -- Multi-criteria (1-5 stars each)
  score_quality   INTEGER NOT NULL CHECK (score_quality BETWEEN 1 AND 5),    -- คุณภาพงาน
  score_punctuality INTEGER NOT NULL CHECK (score_punctuality BETWEEN 1 AND 5), -- ตรงเวลา
  score_attitude  INTEGER NOT NULL CHECK (score_attitude BETWEEN 1 AND 5),   -- ทัศนคติ/มารยาท
  overall_rating  DOUBLE PRECISION NOT NULL,  -- ค่าเฉลี่ยถ่วงน้ำหนัก
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, employer_id, student_id)  -- 1 review ต่อ 1 งาน
);

CREATE INDEX idx_employer_reviews_student ON employer_reviews(student_id);
CREATE INDEX idx_employer_reviews_employer ON employer_reviews(employer_id);

-- ==================== Student reviews Employer (Star 1-5 + Multi-criteria) ====================
CREATE TABLE student_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  student_id      UUID NOT NULL REFERENCES users(id),
  employer_id     UUID NOT NULL REFERENCES users(id),
  -- Multi-criteria (1-5 stars each)
  score_clarity   INTEGER NOT NULL CHECK (score_clarity BETWEEN 1 AND 5),     -- งานชัดเจน
  score_payment   INTEGER NOT NULL CHECK (score_payment BETWEEN 1 AND 5),     -- จ่ายตรงเวลา
  score_safety    INTEGER NOT NULL CHECK (score_safety BETWEEN 1 AND 5),      -- สภาพแวดล้อมปลอดภัย
  overall_rating  DOUBLE PRECISION NOT NULL,  -- ค่าเฉลี่ย
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, student_id, employer_id)
);

CREATE INDEX idx_student_reviews_employer ON student_reviews(employer_id);
CREATE INDEX idx_student_reviews_student ON student_reviews(student_id);

-- ==================== Mentor reviews Trainee (Rubric 1-4 + 3 criteria) ====================
CREATE TABLE mentor_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  mentor_id       UUID NOT NULL REFERENCES users(id),
  trainee_id      UUID NOT NULL REFERENCES users(id),
  -- Rubric 1-4: 4=เยี่ยม, 3=ดี, 2=พอใช้, 1=ต้องปรับปรุง
  score_effort    INTEGER NOT NULL CHECK (score_effort BETWEEN 1 AND 4),      -- ความตั้งใจ
  score_safety    INTEGER NOT NULL CHECK (score_safety BETWEEN 1 AND 4),      -- ความปลอดภัย
  score_skill_dev INTEGER NOT NULL CHECK (score_skill_dev BETWEEN 1 AND 4),   -- ทักษะที่พัฒนา
  weighted_score  DOUBLE PRECISION NOT NULL,  -- ค่าเฉลี่ย
  comment         TEXT,
  recommend_promotion BOOLEAN NOT NULL DEFAULT false,  -- แนะนำเลื่อนขั้น
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, mentor_id, trainee_id)
);

CREATE INDEX idx_mentor_reviews_trainee ON mentor_reviews(trainee_id);
CREATE INDEX idx_mentor_reviews_mentor ON mentor_reviews(mentor_id);

-- ==================== Views for quick rating summary ====================

-- Student rating summary (รวมจากทุกแหล่ง)
CREATE OR REPLACE VIEW student_rating_summary AS
SELECT
  u.id AS student_id,
  u.name,
  u.campus,
  -- จาก Evaluation (อาจารย์)
  COALESCE(te.avg_teacher_score, 0) AS avg_teacher_score,
  COALESCE(te.teacher_review_count, 0) AS teacher_review_count,
  -- จาก Employer Review
  COALESCE(er.avg_employer_rating, 0) AS avg_employer_rating,
  COALESCE(er.employer_review_count, 0) AS employer_review_count,
  -- จาก Mentor Review
  COALESCE(mr.avg_mentor_score, 0) AS avg_mentor_score,
  COALESCE(mr.mentor_review_count, 0) AS mentor_review_count,
  -- Overall
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

-- Employer rating summary
CREATE OR REPLACE VIEW employer_rating_summary AS
SELECT
  u.id AS employer_id,
  u.name,
  ROUND(COALESCE(AVG(sr.overall_rating), 0)::NUMERIC, 2) AS avg_rating,
  COALESCE(COUNT(sr.id), 0) AS review_count,
  ROUND(COALESCE(AVG(sr.score_clarity), 0)::NUMERIC, 2) AS avg_clarity,
  ROUND(COALESCE(AVG(sr.score_payment), 0)::NUMERIC, 2) AS avg_payment,
  ROUND(COALESCE(AVG(sr.score_safety), 0)::NUMERIC, 2) AS avg_safety
FROM users u
LEFT JOIN student_reviews sr ON sr.employer_id = u.id
WHERE u.role = 'employer'
GROUP BY u.id, u.name;
