-- ==========================================
-- SkillChain RMUTL — MASTER SETUP (รวมทุกอย่าง)
-- รันไฟล์นี้ไฟล์เดียวใน Supabase SQL Editor
-- ปลอดภัย: รันซ้ำได้
-- ==========================================

-- ==================== 1. ENUMS ====================
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('student','employer','admin','teacher','donor','superadmin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'project_staff';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'rmutl_staff';

DO $$ BEGIN CREATE TYPE "JobType" AS ENUM ('PAID','VOLUNTEER','TRAINING','EXEMPTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "JobStatus" AS ENUM ('OPEN','ASSIGNED','CONFIRMED','IN_PROGRESS','SUBMITTED','COMPLETED','CANCELLED','DISPUTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "HiringMode" AS ENUM ('MODE_A','MODE_B','MODE_C'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "JobCategory" AS ENUM ('electrical','hvac','automotive','general'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TierLevel" AS ENUM ('trainee','apprentice','certified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BadgeLevel" AS ENUM ('LOCKED','BASIC','TRUSTED','ELITE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AvailabilityStatus" AS ENUM ('available','busy','unavailable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Severity" AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EvalPhase" AS ENUM ('PRE_WORK','IN_PROGRESS','POST_WORK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "EvalPhase" ADD VALUE IF NOT EXISTS 'COMPETENCY_TEST';
DO $$ BEGIN CREATE TYPE "CredentialLevel" AS ENUM ('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_5'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CertifyingBody" AS ENUM ('SYSTEM','PROJECT_BARAMEE','RMUTL_TEACHER','DSD','TPQI','MASTER_TECH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==================== 2. USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  role            "UserRole" NOT NULL DEFAULT 'student',
  name            TEXT NOT NULL DEFAULT '',
  campus          TEXT NOT NULL DEFAULT 'huaykaew',
  wallet_address  TEXT UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  email_verified  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- เพิ่ม columns ที่อาจยังไม่มี
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status "ApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_card TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS year_level INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_registration TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_id_card TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_post_jobs BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_evaluate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve_users BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_credentials BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_approval ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==================== 3. OTHER TABLES ====================
CREATE TABLE IF NOT EXISTS student_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE NOT NULL REFERENCES users(id),
  tier "TierLevel" NOT NULL DEFAULT 'trainee',
  training_jobs_completed INTEGER NOT NULL DEFAULT 0,
  avg_mentor_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  safety_incidents INTEGER NOT NULL DEFAULT 0,
  promoted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS student_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE NOT NULL REFERENCES users(id),
  total_jobs INTEGER NOT NULL DEFAULT 0,
  avg_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  success_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  badge_level "BadgeLevel" NOT NULL DEFAULT 'LOCKED',
  max_job_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  suspended_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS student_availability (
  student_id UUID PRIMARY KEY REFERENCES users(id),
  status "AvailabilityStatus" NOT NULL DEFAULT 'available',
  busy_until TIMESTAMPTZ,
  current_jobs INTEGER NOT NULL DEFAULT 0,
  location TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type "JobType" NOT NULL,
  job_category "JobCategory" NOT NULL DEFAULT 'general',
  status "JobStatus" NOT NULL DEFAULT 'OPEN',
  hiring_mode "HiringMode" NOT NULL DEFAULT 'MODE_A',
  is_mentorship BOOLEAN NOT NULL DEFAULT false,
  location TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT 'huaykaew',
  pay_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  deadline TIMESTAMPTZ NOT NULL DEFAULT now(),
  employer_id UUID NOT NULL REFERENCES users(id),
  student_id UUID REFERENCES users(id),
  mentor_id UUID REFERENCES users(id),
  escrow_tx TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eval_window_start TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eval_window_end TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eval_window_days INTEGER NOT NULL DEFAULT 7;

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_campus ON jobs(campus);
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_student_id ON jobs(student_id);

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  student_id UUID NOT NULL REFERENCES users(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  score_quality DOUBLE PRECISION NOT NULL DEFAULT 0,
  score_skill DOUBLE PRECISION NOT NULL DEFAULT 0,
  score_time DOUBLE PRECISION NOT NULL DEFAULT 0,
  score_tool DOUBLE PRECISION NOT NULL DEFAULT 0,
  weighted_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  comment TEXT,
  nft_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE TABLE IF NOT EXISTS donation_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES users(id),
  amount DOUBLE PRECISION NOT NULL,
  purpose TEXT NOT NULL,
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  restriction_note TEXT,
  nft_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS behavior_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  event_type TEXT NOT NULL,
  severity "Severity" NOT NULL DEFAULT 'low',
  description TEXT NOT NULL DEFAULT '',
  penalty_applied BOOLEAN NOT NULL DEFAULT false,
  on_chain_tx TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_behavior_logs_user_id ON behavior_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_logs_event_type ON behavior_logs(event_type);

-- Reviews
CREATE TABLE IF NOT EXISTS employer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  employer_id UUID NOT NULL REFERENCES users(id),
  student_id UUID NOT NULL REFERENCES users(id),
  score_quality INTEGER NOT NULL CHECK (score_quality BETWEEN 1 AND 5),
  score_punctuality INTEGER NOT NULL CHECK (score_punctuality BETWEEN 1 AND 5),
  score_attitude INTEGER NOT NULL CHECK (score_attitude BETWEEN 1 AND 5),
  overall_rating DOUBLE PRECISION NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, employer_id, student_id)
);
ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE employer_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE TABLE IF NOT EXISTS student_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  student_id UUID NOT NULL REFERENCES users(id),
  employer_id UUID NOT NULL REFERENCES users(id),
  score_clarity INTEGER NOT NULL CHECK (score_clarity BETWEEN 1 AND 5),
  score_payment INTEGER NOT NULL CHECK (score_payment BETWEEN 1 AND 5),
  score_safety INTEGER NOT NULL CHECK (score_safety BETWEEN 1 AND 5),
  overall_rating DOUBLE PRECISION NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, student_id, employer_id)
);
ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE student_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE TABLE IF NOT EXISTS mentor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  mentor_id UUID NOT NULL REFERENCES users(id),
  trainee_id UUID NOT NULL REFERENCES users(id),
  score_effort INTEGER NOT NULL CHECK (score_effort BETWEEN 1 AND 4),
  score_safety INTEGER NOT NULL CHECK (score_safety BETWEEN 1 AND 4),
  score_skill_dev INTEGER NOT NULL CHECK (score_skill_dev BETWEEN 1 AND 4),
  weighted_score DOUBLE PRECISION NOT NULL,
  comment TEXT,
  recommend_promotion BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, mentor_id, trainee_id)
);
ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS eval_phase "EvalPhase" NOT NULL DEFAULT 'POST_WORK';
ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS on_chain_tx TEXT;
ALTER TABLE mentor_reviews ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Credentials
CREATE TABLE IF NOT EXISTS student_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id),
  credential_level "CredentialLevel" NOT NULL DEFAULT 'LEVEL_1',
  certified_by "CertifyingBody" NOT NULL DEFAULT 'SYSTEM',
  certified_by_user_id UUID REFERENCES users(id),
  certificate_ref TEXT,
  specialization TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  nft_tx_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_credentials_student ON student_credentials(student_id);
CREATE INDEX IF NOT EXISTS idx_student_credentials_level ON student_credentials(credential_level);

CREATE TABLE IF NOT EXISTS credential_level_config (
  level "CredentialLevel" PRIMARY KEY,
  level_number INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_th TEXT NOT NULL,
  description_th TEXT NOT NULL,
  certified_by_th TEXT NOT NULL,
  nft_tier TEXT NOT NULL,
  can_mentor BOOLEAN NOT NULL DEFAULT false,
  can_contract BOOLEAN NOT NULL DEFAULT false,
  can_certify_others BOOLEAN NOT NULL DEFAULT false,
  allowed_job_types "JobType"[] NOT NULL DEFAULT '{}'
);
INSERT INTO credential_level_config VALUES
  ('LEVEL_1',1,'Registered','ลงทะเบียน','ลงทะเบียนเข้าระบบแล้ว','ระบบอัตโนมัติ','none',false,false,false,'{}'),
  ('LEVEL_2',2,'Project Certified','ผ่านฝึกอบรมโครงการ','ผ่านฝึกอบรมเบื้องต้น','กลุ่มใต้ร่มพระบารมี','bronze',false,false,false,'{TRAINING,VOLUNTEER}'),
  ('LEVEL_3',3,'Teacher Certified','อาจารย์รับรอง','อาจารย์ มทร.ล้านนา ประเมินผ่าน','อาจารย์ มทร.ล้านนา','silver',false,false,false,'{TRAINING,VOLUNTEER,PAID,EXEMPTED}'),
  ('LEVEL_4',4,'National Certified','สถาบันระดับชาติรับรอง','ใบรับรองจากกรมฝีมือแรงงาน/สคช.','กรมพัฒนาฝีมือแรงงาน/สคช.','gold',true,false,false,'{TRAINING,VOLUNTEER,PAID,EXEMPTED}'),
  ('LEVEL_5',5,'Master Technician','ช่างชำนาญการ','รับเหมาได้ สอนงานและรับรองผู้อื่น','กรมพัฒนาฝีมือแรงงาน+ผลงานสะสม','diamond',true,true,true,'{TRAINING,VOLUNTEER,PAID,EXEMPTED}')
ON CONFLICT (level) DO NOTHING;

-- Approval logs
CREATE TABLE IF NOT EXISTS approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  approved_by UUID NOT NULL REFERENCES users(id),
  action "ApprovalStatus" NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_logs_user ON approval_logs(user_id);

-- ==================== 4. TRIGGERS ====================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trigger_jobs_updated_at ON jobs;
CREATE TRIGGER trigger_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Eval window
CREATE OR REPLACE FUNCTION set_eval_window() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    NEW.eval_window_start = now();
    NEW.eval_window_end = now() + (NEW.eval_window_days || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_set_eval_window ON jobs;
CREATE TRIGGER trigger_set_eval_window BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION set_eval_window();

-- ==================== 5. AUTH TRIGGER (สำคัญที่สุด) ====================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  INSERT INTO public.users (
    id, email, name, role, campus,
    approval_status,
    student_id_card, faculty, year_level,
    organization, org_registration, org_address,
    staff_position, teacher_id_card,
    is_active, email_verified,
    can_post_jobs, can_evaluate, can_approve_users, can_manage_credentials
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    v_role::"UserRole",
    COALESCE(NEW.raw_user_meta_data->>'campus', 'huaykaew'),
    'PENDING'::"ApprovalStatus",
    NEW.raw_user_meta_data->>'student_id_card',
    NEW.raw_user_meta_data->>'faculty',
    (NEW.raw_user_meta_data->>'year_level')::INTEGER,
    NEW.raw_user_meta_data->>'organization',
    NEW.raw_user_meta_data->>'org_registration',
    NEW.raw_user_meta_data->>'org_address',
    NEW.raw_user_meta_data->>'staff_position',
    NEW.raw_user_meta_data->>'teacher_id_card',
    true,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    v_role IN ('employer','teacher','project_staff','rmutl_staff','admin','superadmin'),
    v_role IN ('teacher','project_staff','rmutl_staff','admin','superadmin'),
    v_role IN ('admin','superadmin'),
    v_role IN ('teacher','project_staff','admin','superadmin')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- ถ้า insert ล้มเหลว (เช่น user มีอยู่แล้ว) ให้ข้ามไป ไม่ block การสมัคร
  RAISE WARNING 'handle_new_user failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== 6. SYNC EXISTING USERS ====================
INSERT INTO public.users (
  id, email, name, role, campus, approval_status,
  is_active, email_verified,
  can_post_jobs, can_evaluate, can_approve_users, can_manage_credentials
)
SELECT
  au.id, au.email,
  COALESCE(au.raw_user_meta_data->>'name', ''),
  COALESCE(au.raw_user_meta_data->>'role', 'student')::"UserRole",
  COALESCE(au.raw_user_meta_data->>'campus', 'huaykaew'),
  'APPROVED'::"ApprovalStatus",
  true, true,
  COALESCE(au.raw_user_meta_data->>'role','student') IN ('employer','teacher','project_staff','rmutl_staff','admin','superadmin'),
  COALESCE(au.raw_user_meta_data->>'role','student') IN ('teacher','project_staff','rmutl_staff','admin','superadmin'),
  COALESCE(au.raw_user_meta_data->>'role','student') IN ('admin','superadmin'),
  COALESCE(au.raw_user_meta_data->>'role','student') IN ('teacher','project_staff','admin','superadmin')
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- หมายเหตุ: user ใหม่จะเป็น PENDING ต้องให้ admin approve
-- ถ้าต้องการ approve ทุกคนที่มีอยู่: UPDATE users SET approval_status = 'APPROVED';

-- ==================== 7. VIEWS ====================
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
    (COALESCE(te.avg_teacher_score,0)*0.4 + COALESCE(er.avg_employer_rating,0)*0.35 + COALESCE(mr.avg_mentor_score,0)*0.25)
    / GREATEST(
      (CASE WHEN te.avg_teacher_score > 0 THEN 0.4 ELSE 0 END) +
      (CASE WHEN er.avg_employer_rating > 0 THEN 0.35 ELSE 0 END) +
      (CASE WHEN mr.avg_mentor_score > 0 THEN 0.25 ELSE 0 END), 0.01
    ) AS NUMERIC), 2) AS combined_score
FROM users u
LEFT JOIN (SELECT DISTINCT ON (student_id) student_id, credential_level FROM student_credentials WHERE is_active = true AND (expires_at IS NULL OR expires_at > now()) ORDER BY student_id, credential_level DESC) sc ON sc.student_id = u.id
LEFT JOIN credential_level_config clc ON clc.level = COALESCE(sc.credential_level, 'LEVEL_1')
LEFT JOIN (SELECT student_id, ROUND(AVG(weighted_score)::NUMERIC,2) AS avg_teacher_score, COUNT(*) AS teacher_review_count FROM evaluations GROUP BY student_id) te ON te.student_id = u.id
LEFT JOIN (SELECT student_id, ROUND(AVG(overall_rating)::NUMERIC,2) AS avg_employer_rating, COUNT(*) AS employer_review_count FROM employer_reviews GROUP BY student_id) er ON er.student_id = u.id
LEFT JOIN (SELECT trainee_id, ROUND(AVG(weighted_score)::NUMERIC,2) AS avg_mentor_score, COUNT(*) AS mentor_review_count FROM mentor_reviews GROUP BY trainee_id) mr ON mr.trainee_id = u.id
WHERE u.role = 'student';

DROP VIEW IF EXISTS employer_rating_summary;
CREATE VIEW employer_rating_summary AS
SELECT u.id AS employer_id, u.name,
  ROUND(COALESCE(AVG(sr.overall_rating),0)::NUMERIC,2) AS avg_rating,
  COALESCE(COUNT(sr.id),0) AS review_count,
  ROUND(COALESCE(AVG(sr.score_clarity),0)::NUMERIC,2) AS avg_clarity,
  ROUND(COALESCE(AVG(sr.score_payment),0)::NUMERIC,2) AS avg_payment,
  ROUND(COALESCE(AVG(sr.score_safety),0)::NUMERIC,2) AS avg_safety
FROM users u LEFT JOIN student_reviews sr ON sr.employer_id = u.id
WHERE u.role = 'employer' GROUP BY u.id, u.name;

-- ==================== 8. RLS POLICIES (Pilot Phase — เปิดหมด) ====================
-- เปิด RLS + allow all สำหรับทุก table
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
