-- ============================================================================
-- QR + PIN Quick Authentication System
-- ============================================================================
-- Frictionless auth สำหรับ employer/student/mentor:
-- - User มี QR (permanent) + PIN (6 หลัก, system-generated)
-- - Login = scan QR + กรอก PIN (ไม่ต้อง email/password)
-- - Job QR = สมาร์ท redirect ตาม role+state
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. User PINs (6-digit hash + salt + lockout)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_user_pins" (
  user_id           TEXT PRIMARY KEY REFERENCES "skc_users"(id) ON DELETE CASCADE,
  pin_hash          TEXT NOT NULL,                   -- bcrypt hash
  pin_set_at        TIMESTAMPTZ DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ,
  failed_attempts   INTEGER DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  must_change       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_pins_locked ON "skc_user_pins"(locked_until);

-- ----------------------------------------------------------------------------
-- 2. User QR Tokens (permanent login QR)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_user_qr_tokens" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT REFERENCES "skc_users"(id) ON DELETE CASCADE,
  qr_token          TEXT UNIQUE NOT NULL,            -- short token in URL
  is_active         BOOLEAN DEFAULT TRUE,
  scan_count        INTEGER DEFAULT 0,
  last_scanned_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,                     -- NULL = never expires
  revoked_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_qr_token ON "skc_user_qr_tokens"(qr_token);
CREATE INDEX IF NOT EXISTS idx_user_qr_user ON "skc_user_qr_tokens"(user_id, is_active);

-- ----------------------------------------------------------------------------
-- 3. Job QR Tokens (smart context-aware)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_job_qr_tokens" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            TEXT REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  qr_token          TEXT UNIQUE NOT NULL,
  scan_count        INTEGER DEFAULT 0,
  last_scanned_at   TIMESTAMPTZ,
  last_scanned_by   TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_qr_token ON "skc_job_qr_tokens"(qr_token);
CREATE INDEX IF NOT EXISTS idx_job_qr_job ON "skc_job_qr_tokens"(job_id);

-- ----------------------------------------------------------------------------
-- 4. Quick Sessions (separate from Supabase Auth — 7 day expiry)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_quick_sessions" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT REFERENCES "skc_users"(id) ON DELETE CASCADE,
  session_token     TEXT UNIQUE NOT NULL,            -- random 32+ chars
  device_fingerprint TEXT,
  user_agent        TEXT,
  ip_address        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  last_activity_at  TIMESTAMPTZ DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quick_session_token ON "skc_quick_sessions"(session_token);
CREATE INDEX IF NOT EXISTS idx_quick_session_user ON "skc_quick_sessions"(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_session_expires ON "skc_quick_sessions"(expires_at);

-- ----------------------------------------------------------------------------
-- 5. Invitation Tokens (for staff to invite employers/users)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_invitations" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_token      TEXT UNIQUE NOT NULL,
  intended_role     TEXT NOT NULL,                   -- 'employer', 'student', etc.
  created_by        TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  notes             TEXT,
  -- Pre-fill data (optional)
  prefilled_name    TEXT,
  prefilled_email   TEXT,
  prefilled_phone   TEXT,
  prefilled_org     TEXT,
  -- State
  used_by           TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  used_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL,
  max_uses          INTEGER DEFAULT 1,               -- 1 = single-use
  use_count         INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  revoked_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON "skc_invitations"(invite_token);
CREATE INDEX IF NOT EXISTS idx_invitations_role ON "skc_invitations"(intended_role);

-- ----------------------------------------------------------------------------
-- 6. Add phone column to users (for Tier 1 lookup, optional)
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_users"
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS quick_auth_enabled BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_phone ON "skc_users"(phone) WHERE phone IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7. RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_user_pins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_user_qr_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_job_qr_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_quick_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_invitations" ENABLE ROW LEVEL SECURITY;

-- PINs: only service role + admin can write; user can verify own
DROP POLICY IF EXISTS "user_pins_admin_all" ON "skc_user_pins";
CREATE POLICY "user_pins_admin_all" ON "skc_user_pins" FOR ALL
  USING (
    auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

-- User QR tokens: user sees own, staff sees all
DROP POLICY IF EXISTS "user_qr_read" ON "skc_user_qr_tokens";
CREATE POLICY "user_qr_read" ON "skc_user_qr_tokens" FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "user_qr_write" ON "skc_user_qr_tokens";
CREATE POLICY "user_qr_write" ON "skc_user_qr_tokens" FOR ALL
  USING (
    auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

-- Job QR tokens: anyone can read (it's a public scan target), staff can write
DROP POLICY IF EXISTS "job_qr_read" ON "skc_job_qr_tokens";
CREATE POLICY "job_qr_read" ON "skc_job_qr_tokens" FOR SELECT USING (true);

DROP POLICY IF EXISTS "job_qr_write" ON "skc_job_qr_tokens";
CREATE POLICY "job_qr_write" ON "skc_job_qr_tokens" FOR ALL
  USING (
    auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'employer')
    )
  );

-- Quick sessions: user owns own, no one else
DROP POLICY IF EXISTS "quick_session_own" ON "skc_quick_sessions";
CREATE POLICY "quick_session_own" ON "skc_quick_sessions" FOR ALL
  USING (user_id = auth.uid()::text);

-- Invitations: staff manages
DROP POLICY IF EXISTS "invitations_staff" ON "skc_invitations";
CREATE POLICY "invitations_staff" ON "skc_invitations" FOR ALL
  USING (
    auth.uid()::text IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Auto-cleanup expired sessions (helper function)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_cleanup_expired_quick_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM "skc_quick_sessions"
  WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- Call: SELECT fn_cleanup_expired_quick_sessions();
