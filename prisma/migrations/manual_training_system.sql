-- =====================================================
-- Training System — หลักสูตรฝึกอบรมทักษะช่าง
-- Phase 1: Volunteer Mode (วิทยากรยังไม่รับค่าตอบแทน)
-- =====================================================

-- Enum types
DO $$ BEGIN
  CREATE TYPE course_status AS ENUM ('DRAFT', 'OPEN_ENROLLMENT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE training_provider AS ENUM ('RMUTL_TEACHER', 'PROJECT_BARAMEE', 'DSD_PARTNER', 'TPQI_PARTNER', 'EXTERNAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_mode AS ENUM ('VOLUNTEER', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Training Courses
CREATE TABLE IF NOT EXISTS skc_training_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',     -- electrical, hvac, automotive, general
  provider training_provider NOT NULL DEFAULT 'RMUTL_TEACHER',
  instructor_id UUID NOT NULL REFERENCES skc_users(id),
  status course_status NOT NULL DEFAULT 'DRAFT',

  -- เวลาและความจุ
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  total_hours REAL NOT NULL DEFAULT 0,
  max_participants INT NOT NULL DEFAULT 20,
  min_participants INT NOT NULL DEFAULT 1,
  is_open_to_external BOOLEAN NOT NULL DEFAULT false,

  -- การจ่ายเงิน
  payment_mode payment_mode NOT NULL DEFAULT 'VOLUNTEER',
  hourly_rate_trpb REAL NOT NULL DEFAULT 0,
  per_pass_rate_trpb REAL NOT NULL DEFAULT 0,
  total_budget_trpb REAL NOT NULL DEFAULT 0,
  pledged_trpb REAL NOT NULL DEFAULT 0,          -- ยอดค้างจ่ายสะสม (volunteer mode)
  funding_source TEXT,
  escrow_tx TEXT,

  -- ระดับ credential ที่ได้หลังผ่าน
  grants_credential_level TEXT,                   -- LEVEL_1..LEVEL_5

  -- Cover image
  cover_image_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Training Modules (บทเรียนย่อยของหลักสูตร)
CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES skc_training_courses(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  competency_code TEXT,       -- รหัสมาตรฐานสมรรถนะ (DSD/TPQI)
  hours REAL NOT NULL DEFAULT 0,
  pass_criteria TEXT NOT NULL DEFAULT 'ผ่านการทดสอบ',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(course_id, sort_order)
);

-- Training Enrollments (ลงทะเบียนเรียน)
CREATE TABLE IF NOT EXISTS skc_training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES skc_training_courses(id) ON DELETE CASCADE,
  trainee_id UUID NOT NULL REFERENCES skc_users(id),
  is_external BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  certificate_number TEXT,     -- เลขที่ใบรับรอง (auto-generated)
  certificate_tx TEXT,         -- NFT tx hash

  UNIQUE(course_id, trainee_id)
);

-- Module Assessments (ประเมินผลแต่ละโมดูล)
CREATE TABLE IF NOT EXISTS module_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES skc_training_enrollments(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL DEFAULT false,
  score REAL,
  evidence_url TEXT,           -- รูป/ไฟล์หลักฐาน
  assessor_id UUID NOT NULL REFERENCES skc_users(id),
  note TEXT,
  on_chain_tx TEXT,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(module_id, enrollment_id)
);

-- RLS Policies
ALTER TABLE skc_training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE skc_training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_assessments ENABLE ROW LEVEL SECURITY;

-- Read: authenticated skc_users
CREATE POLICY "training_courses_read" ON skc_training_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_modules_read" ON training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_enrollments_read" ON skc_training_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "module_assessments_read" ON module_assessments FOR SELECT TO authenticated USING (true);

-- Insert: staff/instructor for courses/modules, anyone authenticated for enrollments
CREATE POLICY "training_courses_insert" ON skc_training_courses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "training_modules_insert" ON training_modules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "training_enrollments_insert" ON skc_training_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "module_assessments_insert" ON module_assessments FOR INSERT TO authenticated WITH CHECK (true);

-- Update: staff/instructor
CREATE POLICY "training_courses_update" ON skc_training_courses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "training_enrollments_update" ON skc_training_enrollments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "module_assessments_update" ON module_assessments FOR UPDATE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_courses_status ON skc_training_courses(status);
CREATE INDEX IF NOT EXISTS idx_training_courses_instructor ON skc_training_courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_course ON skc_training_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_trainee ON skc_training_enrollments(trainee_id);
CREATE INDEX IF NOT EXISTS idx_module_assessments_enrollment ON module_assessments(enrollment_id);
