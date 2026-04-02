-- ==========================================
-- SkillChain RMUTL - Database Schema
-- Run this in Supabase SQL Editor
-- ==========================================

-- Enums
CREATE TYPE "UserRole" AS ENUM ('student', 'employer', 'admin', 'teacher', 'donor', 'superadmin');
CREATE TYPE "TierLevel" AS ENUM ('trainee', 'apprentice', 'certified');
CREATE TYPE "BadgeLevel" AS ENUM ('LOCKED', 'BASIC', 'TRUSTED', 'ELITE');
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'busy', 'unavailable');
CREATE TYPE "JobType" AS ENUM ('PAID', 'VOLUNTEER', 'TRAINING', 'EXEMPTED');
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED', 'DISPUTED');
CREATE TYPE "HiringMode" AS ENUM ('MODE_A', 'MODE_B', 'MODE_C');
CREATE TYPE "JobCategory" AS ENUM ('electrical', 'hvac', 'automotive', 'general');
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- ==================== Users ====================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  role            "UserRole" NOT NULL DEFAULT 'student',
  name            TEXT NOT NULL,
  campus          TEXT NOT NULL DEFAULT 'huaykaew',
  wallet_address  TEXT UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  email_verified  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- ==================== Student Tier System ====================
CREATE TABLE student_tiers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              UUID UNIQUE NOT NULL REFERENCES users(id),
  tier                    "TierLevel" NOT NULL DEFAULT 'trainee',
  training_jobs_completed INTEGER NOT NULL DEFAULT 0,
  avg_mentor_score        DOUBLE PRECISION NOT NULL DEFAULT 0,
  safety_incidents        INTEGER NOT NULL DEFAULT 0,
  promoted_at             TIMESTAMPTZ
);

CREATE TABLE student_qualifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID UNIQUE NOT NULL REFERENCES users(id),
  total_jobs      INTEGER NOT NULL DEFAULT 0,
  avg_score       DOUBLE PRECISION NOT NULL DEFAULT 0,
  success_rate    DOUBLE PRECISION NOT NULL DEFAULT 0,
  badge_level     "BadgeLevel" NOT NULL DEFAULT 'LOCKED',
  max_job_value   DOUBLE PRECISION NOT NULL DEFAULT 0,
  suspended_until TIMESTAMPTZ
);

CREATE TABLE student_availability (
  student_id   UUID PRIMARY KEY REFERENCES users(id),
  status       "AvailabilityStatus" NOT NULL DEFAULT 'available',
  busy_until   TIMESTAMPTZ,
  current_jobs INTEGER NOT NULL DEFAULT 0,
  location     TEXT
);

-- ==================== Jobs ====================
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  type          "JobType" NOT NULL,
  job_category  "JobCategory" NOT NULL,
  status        "JobStatus" NOT NULL DEFAULT 'OPEN',
  hiring_mode   "HiringMode" NOT NULL DEFAULT 'MODE_A',
  is_mentorship BOOLEAN NOT NULL DEFAULT false,
  location      TEXT NOT NULL,
  campus        TEXT NOT NULL,
  pay_amount    DOUBLE PRECISION NOT NULL DEFAULT 0,
  deadline      TIMESTAMPTZ NOT NULL,
  employer_id   UUID NOT NULL REFERENCES users(id),
  student_id    UUID REFERENCES users(id),
  mentor_id     UUID REFERENCES users(id),
  escrow_tx     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_campus ON jobs(campus);
CREATE INDEX idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX idx_jobs_student_id ON jobs(student_id);

-- ==================== Evaluations ====================
CREATE TABLE evaluations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id),
  student_id     UUID NOT NULL REFERENCES users(id),
  teacher_id     UUID NOT NULL REFERENCES users(id),
  score_quality  DOUBLE PRECISION NOT NULL,
  score_skill    DOUBLE PRECISION NOT NULL,
  score_time     DOUBLE PRECISION NOT NULL,
  score_tool     DOUBLE PRECISION NOT NULL,
  weighted_score DOUBLE PRECISION NOT NULL,
  comment        TEXT,
  nft_tx_hash    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== Fund System ====================
CREATE TABLE donation_funds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id         UUID NOT NULL REFERENCES users(id),
  amount           DOUBLE PRECISION NOT NULL,
  purpose          TEXT NOT NULL,
  is_restricted    BOOLEAN NOT NULL DEFAULT false,
  restriction_note TEXT,
  nft_tx_hash      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== Behavior Log ====================
CREATE TABLE behavior_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  job_id          UUID REFERENCES jobs(id),
  event_type      TEXT NOT NULL,
  severity        "Severity" NOT NULL DEFAULT 'low',
  description     TEXT NOT NULL,
  penalty_applied BOOLEAN NOT NULL DEFAULT false,
  on_chain_tx     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_behavior_logs_user_id ON behavior_logs(user_id);
CREATE INDEX idx_behavior_logs_event_type ON behavior_logs(event_type);

-- ==================== Auto-update updated_at ====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
