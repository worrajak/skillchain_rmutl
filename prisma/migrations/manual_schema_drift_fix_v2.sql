-- =========================================================================
-- Schema drift fix v2 — tailored to actual Supabase state (per CSV probe)
-- Safe to re-run. Skips tables that already exist correctly.
-- Apply via Supabase Dashboard → SQL Editor
-- =========================================================================

-- ---------- 0. Legacy notifications table belongs to another project.
--              Rename it out of the way so we can create ours.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='project_id'
  ) THEN
    ALTER TABLE "notifications" RENAME CONSTRAINT "notifications_pkey" TO "notifications_legacy_pkey";
    ALTER TABLE "notifications" RENAME TO "notifications_legacy_other_project";
  END IF;
END $$;

-- ---------- 1. jobs: missing columns ----------
ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "approved_by_staff"             UUID REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "staff_approval_at"             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "work_start_date"               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "work_end_date"                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "schedule_proposed_by"          UUID REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "schedule_confirmed"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "staff_confirmed_completion"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "employer_confirmed_completion" BOOLEAN NOT NULL DEFAULT false;

-- ---------- 2. notifications (fresh) ----------
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"       TEXT         NOT NULL,
  "title"      TEXT         NOT NULL,
  "body"       TEXT         NOT NULL,
  "link"       TEXT,
  "is_read"    BOOLEAN      NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx"     ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "notifications"("user_id","is_read") WHERE "is_read" = false;

-- ---------- 3. job_chat_rooms ----------
CREATE TABLE IF NOT EXISTS "job_chat_rooms" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "job_id"      UUID        NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "is_locked"   BOOLEAN     NOT NULL DEFAULT false,
  "employer_id" UUID        REFERENCES "users"("id"),
  "student_id"  UUID        REFERENCES "users"("id"),
  "mentor_id"   UUID        REFERENCES "users"("id"),
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "job_chat_rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "job_chat_rooms_job_id_key" ON "job_chat_rooms"("job_id");

-- ---------- 4. chat_messages ----------
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "room_id"      UUID        NOT NULL REFERENCES "job_chat_rooms"("id") ON DELETE CASCADE,
  "sender_id"    UUID        NOT NULL REFERENCES "users"("id"),
  "content"      TEXT        NOT NULL,
  "message_type" TEXT        NOT NULL DEFAULT 'TEXT',
  "content_hash" TEXT,
  "metadata"     JSONB,
  "is_deleted"   BOOLEAN     NOT NULL DEFAULT false,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_messages_room_id_idx" ON "chat_messages"("room_id","created_at");

-- ---------- 5. chat_participants ----------
CREATE TABLE IF NOT EXISTS "chat_participants" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "room_id"      UUID        NOT NULL REFERENCES "job_chat_rooms"("id") ON DELETE CASCADE,
  "user_id"      UUID        NOT NULL REFERENCES "users"("id"),
  "role_in_chat" TEXT        NOT NULL,
  "is_deleted"   BOOLEAN     NOT NULL DEFAULT false,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "chat_participants_room_user_key" ON "chat_participants"("room_id","user_id");

-- ---------- 6. job_agreements ----------
DO $$ BEGIN
  CREATE TYPE "AgreementStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "job_agreements" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "job_id"         UUID        NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "proposed_by"    UUID        NOT NULL REFERENCES "users"("id"),
  "agreement_type" TEXT        NOT NULL,
  "terms"          TEXT        NOT NULL,
  "status"         "AgreementStatus" NOT NULL DEFAULT 'PENDING',
  "accepted_by"    UUID        REFERENCES "users"("id"),
  "content_hash"   TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "job_agreements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "job_agreements_job_id_idx" ON "job_agreements"("job_id");

-- ---------- 7. disputes ----------
DO $$ BEGIN
  CREATE TYPE "DisputeStatus" AS ENUM ('RAISED','UNDER_REVIEW','MEDIATION','RESOLVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "disputes" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "job_id"           UUID        NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "raised_by"        UUID        NOT NULL REFERENCES "users"("id"),
  "raised_against"   UUID        NOT NULL REFERENCES "users"("id"),
  "arbitrator_id"    UUID        REFERENCES "users"("id"),
  "category"         TEXT        NOT NULL,
  "description"      TEXT        NOT NULL,
  "evidence_urls"    JSONB,
  "status"           "DisputeStatus" NOT NULL DEFAULT 'RAISED',
  "resolution_terms" TEXT,
  "resolved_at"      TIMESTAMPTZ,
  "content_hash"     TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "disputes_job_id_idx" ON "disputes"("job_id");
CREATE INDEX IF NOT EXISTS "disputes_status_idx" ON "disputes"("status");

-- ---------- 8. job_cancellation_requests ----------
DO $$ BEGIN
  CREATE TYPE "CancellationStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "job_cancellation_requests" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "job_id"        UUID        NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "requested_by"  UUID        NOT NULL REFERENCES "users"("id"),
  "reason"        TEXT        NOT NULL,
  "reason_detail" TEXT,
  "status"        "CancellationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by"   UUID        REFERENCES "users"("id"),
  "reviewed_at"   TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "job_cancellation_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "job_cancellation_requests_status_idx" ON "job_cancellation_requests"("status");

-- ---------- 9. fee_config (singleton) ----------
CREATE TABLE IF NOT EXISTS "fee_config" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "student_bps" INTEGER     NOT NULL DEFAULT 8500,
  "fund_bps"    INTEGER     NOT NULL DEFAULT 500,
  "mentor_bps"  INTEGER     NOT NULL DEFAULT 500,
  "staff_bps"   INTEGER     NOT NULL DEFAULT 500,
  "updated_by"  UUID        REFERENCES "users"("id"),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "fee_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_config_sum_bps_check" CHECK (student_bps + fund_bps + mentor_bps + staff_bps = 10000)
);
INSERT INTO "fee_config" ("student_bps","fund_bps","mentor_bps","staff_bps")
SELECT 8500,500,500,500 WHERE NOT EXISTS (SELECT 1 FROM "fee_config");

-- NOTE: approval_logs, student_rating_summary, employer_rating_summary
--       already exist and match app expectations — NOT touching them.

-- =========================================================================
-- RLS — enable + minimal policies for new tables
-- =========================================================================
ALTER TABLE "notifications"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_chat_rooms"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_participants"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_agreements"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disputes"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_cancellation_requests"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_config"                 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_owner_select" ON "notifications";
CREATE POLICY "notif_owner_select" ON "notifications" FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_owner_update" ON "notifications";
CREATE POLICY "notif_owner_update" ON "notifications" FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_auth_insert" ON "notifications";
CREATE POLICY "notif_auth_insert"  ON "notifications" FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "fee_read" ON "fee_config";
CREATE POLICY "fee_read" ON "fee_config" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fee_admin_write" ON "fee_config";
CREATE POLICY "fee_admin_write" ON "fee_config" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin','superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin','superadmin')));

DROP POLICY IF EXISTS "chat_auth_all" ON "job_chat_rooms";
CREATE POLICY "chat_auth_all" ON "job_chat_rooms" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "msg_auth_all" ON "chat_messages";
CREATE POLICY "msg_auth_all"  ON "chat_messages" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "part_auth_all" ON "chat_participants";
CREATE POLICY "part_auth_all" ON "chat_participants" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "agr_auth_all" ON "job_agreements";
CREATE POLICY "agr_auth_all" ON "job_agreements" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "disp_auth_all" ON "disputes";
CREATE POLICY "disp_auth_all" ON "disputes" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "canc_auth_all" ON "job_cancellation_requests";
CREATE POLICY "canc_auth_all" ON "job_cancellation_requests" FOR ALL TO authenticated USING (true) WITH CHECK (true);
