-- ==========================================
-- SkillChain RMUTL — Governance System
-- Job cancellation, chat, disputes, WI, notifications
-- รันซ้ำได้ปลอดภัย
-- ==========================================

-- ==================== ENUMS ====================
DO $$ BEGIN CREATE TYPE "CancellationReason" AS ENUM ('DISTANCE','SAFETY','TIMING','UNFAIR_PAY','STUDENT_UNAVAILABLE','SCOPE_CHANGE','INAPPROPRIATE','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ChatMessageType" AS ENUM ('TEXT','AGREEMENT','AGREEMENT_ACK','SYSTEM','FILE','DISPUTE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DisputeStatus" AS ENUM ('RAISED','UNDER_REVIEW','MEDIATION','RESOLVED_STUDENT_FAVOR','RESOLVED_EMPLOYER_FAVOR','RESOLVED_COMPROMISE','ESCALATED','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DisputeCategory" AS ENUM ('SKILL_INSUFFICIENT','SCOPE_CHANGED','DANGER_RISK','PAY_DISPUTE','QUALITY_ISSUE','NO_SHOW','HARASSMENT','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==================== 1. JOB CANCELLATION REQUESTS ====================
CREATE TABLE IF NOT EXISTS job_cancellation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  requested_by    UUID NOT NULL REFERENCES users(id),
  reason          "CancellationReason" NOT NULL,
  reason_detail   TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cancel_req_job ON job_cancellation_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_cancel_req_status ON job_cancellation_requests(status);

-- ==================== 2. CHAT SYSTEM ====================
CREATE TABLE IF NOT EXISTS job_chat_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL UNIQUE REFERENCES jobs(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_locked   BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES job_chat_rooms(id),
  sender_id       UUID NOT NULL REFERENCES users(id),
  message_type    "ChatMessageType" NOT NULL DEFAULT 'TEXT',
  content         TEXT NOT NULL,
  content_hash    TEXT,
  on_chain_tx     TEXT,
  metadata        JSONB,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

CREATE TABLE IF NOT EXISTS chat_participants (
  room_id     UUID NOT NULL REFERENCES job_chat_rooms(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  role_in_chat TEXT NOT NULL CHECK (role_in_chat IN ('employer','student','teacher','staff','arbitrator')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS job_agreements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  proposed_by     UUID NOT NULL REFERENCES users(id),
  accepted_by     UUID REFERENCES users(id),
  agreement_type  TEXT NOT NULL,
  terms           JSONB NOT NULL,
  content_hash    TEXT NOT NULL,
  on_chain_tx     TEXT,
  status          TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','ACCEPTED','REJECTED','SUPERSEDED')),
  message_id      UUID REFERENCES chat_messages(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agreements_job ON job_agreements(job_id);

-- ==================== 3. DISPUTES ====================
CREATE TABLE IF NOT EXISTS disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  raised_by       UUID NOT NULL REFERENCES users(id),
  raised_against  UUID NOT NULL REFERENCES users(id),
  category        "DisputeCategory" NOT NULL,
  status          "DisputeStatus" NOT NULL DEFAULT 'RAISED',
  description     TEXT NOT NULL,
  evidence_urls   TEXT[],
  arbitrator_id   UUID REFERENCES users(id),
  resolution      TEXT,
  resolution_terms JSONB,
  content_hash    TEXT,
  on_chain_tx     TEXT,
  raised_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_at     TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disputes_job ON disputes(job_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_arbitrator ON disputes(arbitrator_id);

CREATE TABLE IF NOT EXISTS dispute_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID NOT NULL REFERENCES disputes(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispute_comments_dispute ON dispute_comments(dispute_id);

-- ==================== 4. WORK INSTRUCTIONS ====================
CREATE TABLE IF NOT EXISTS work_instruction_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_category    "JobCategory" NOT NULL,
  title           TEXT NOT NULL,
  version         TEXT NOT NULL DEFAULT '1.0',
  scope           TEXT NOT NULL,
  prerequisites   JSONB NOT NULL DEFAULT '{}',
  safety_checklist JSONB NOT NULL DEFAULT '[]',
  steps           JSONB NOT NULL DEFAULT '[]',
  quality_criteria JSONB NOT NULL DEFAULT '[]',
  tools_required  JSONB NOT NULL DEFAULT '[]',
  estimated_duration TEXT,
  ilo_reference   TEXT,
  iso_reference   TEXT,
  created_by      UUID NOT NULL REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wi_templates_category ON work_instruction_templates(job_category);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS wi_template_id UUID REFERENCES work_instruction_templates(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS approved_by_staff UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staff_approval_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS safety_checklist_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS job_safety_checks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES jobs(id),
  checked_by  UUID NOT NULL REFERENCES users(id),
  checklist   JSONB NOT NULL,
  all_passed  BOOLEAN NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_checks_job ON job_safety_checks(job_id);

-- ==================== 5. ASSIGNMENT REQUESTS (staff gatekeeper) ====================
CREATE TABLE IF NOT EXISTS job_assignment_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  student_id      UUID NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by     UUID REFERENCES users(id),
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  UNIQUE(job_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_req_status ON job_assignment_requests(status);

-- ==================== 6. NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ==================== 7. RLS for new tables ====================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'job_cancellation_requests','job_chat_rooms','chat_messages','chat_participants',
    'job_agreements','disputes','dispute_comments','work_instruction_templates',
    'job_safety_checks','job_assignment_requests','notifications'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ==================== 8. Enable Realtime ====================
-- ใน Supabase Dashboard → Database → Replication: เปิด realtime สำหรับ
-- chat_messages, notifications, disputes, job_assignment_requests, job_cancellation_requests
