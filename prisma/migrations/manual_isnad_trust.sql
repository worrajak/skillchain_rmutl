-- Isnad Trust System — trust score + grade per user, plus audit-log
-- ดูออกแบบเต็มที่ docs/ISNAD_TRUST_PROPOSAL.md
--
-- หลัก: 4 layers (identity 30 / track 40 / chain 20 / social 10) → 0-100
-- Grade: SAHIH ≥90 · HASAN ≥70 · DAIF ≥40 · MAWDU <40
--
-- Confirmed defaults:
-- 1. Initial = 30 (Da'if) for new users
-- 2. staff/teacher/admin = 70 (Hasan) institutional baseline
-- 3. Penalties: NO_SHOW -3 · dispute -10 · late -1
-- 4. Visibility = Public
-- 5. Soft launch (badge only, no enforcement yet)
-- 6. Backfill existing users from history

-- =============================================================
-- 1) Extend skc_users with trust fields
-- =============================================================
ALTER TABLE skc_users
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC(5,2) NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS trust_grade TEXT NOT NULL DEFAULT 'DAIF'
    CHECK (trust_grade IN ('SAHIH','HASAN','DAIF','MAWDU')),
  ADD COLUMN IF NOT EXISTS trust_last_computed TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trust_approved_by TEXT REFERENCES skc_users(id);

COMMENT ON COLUMN skc_users.trust_score IS
  'Isnad-based trust 0-100 — recomputed on key events';
COMMENT ON COLUMN skc_users.trust_grade IS
  'SAHIH ≥90 · HASAN ≥70 · DAIF ≥40 · MAWDU <40 (Hadith classification analog)';
COMMENT ON COLUMN skc_users.trust_approved_by IS
  'User who vouched for this account during onboarding — chain root';

CREATE INDEX IF NOT EXISTS idx_users_trust ON skc_users(trust_grade, trust_score DESC);

-- =============================================================
-- 2) Trust event audit log
-- =============================================================
CREATE TABLE IF NOT EXISTS skc_trust_events (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL REFERENCES skc_users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  -- COMPLETED_JOB, NO_SHOW, DISPUTE_LOST, DISPUTE_WON,
  -- REVIEW_HIGH, REVIEW_LOW, LATE_SUBMIT, IDENTITY_VERIFIED, BATCH_APPROVED,
  -- VOUCHED_BY_TRUSTED, MANUAL_ADJUST
  delta        NUMERIC NOT NULL,
  reason       TEXT,
  job_id       TEXT REFERENCES skc_jobs(id) ON DELETE SET NULL,
  triggered_by TEXT REFERENCES skc_users(id) ON DELETE SET NULL,
  score_before NUMERIC,
  score_after  NUMERIC,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_events_user
  ON skc_trust_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_events_type
  ON skc_trust_events(event_type);

-- =============================================================
-- 3) RLS
-- =============================================================
ALTER TABLE skc_trust_events ENABLE ROW LEVEL SECURITY;

-- Public read (โปร่งใสตามหลักอิสลาม)
DROP POLICY IF EXISTS "trust_events_public_read" ON skc_trust_events;
CREATE POLICY "trust_events_public_read" ON skc_trust_events
  FOR SELECT
  USING (true);

-- Only system/admin write (events ออกจาก server-side SECURITY DEFINER fn)
DROP POLICY IF EXISTS "trust_events_admin_write" ON skc_trust_events;
CREATE POLICY "trust_events_admin_write" ON skc_trust_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skc_users
      WHERE id = auth.uid()::text
        AND role IN ('admin','superadmin','project_staff','rmutl_staff','teacher')
    )
  );

-- =============================================================
-- 4) Compute trust score (SQL helper — single source of truth)
-- =============================================================
CREATE OR REPLACE FUNCTION fn_compute_trust_score(p_user_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
  u RECORD;
  identity_layer NUMERIC := 0;
  track_layer NUMERIC := 0;
  chain_layer NUMERIC := 0;
  social_layer NUMERIC := 0;
  completed_count INT := 0;
  no_show_count INT := 0;
  disputes_lost_count INT := 0;
  total_jobs INT := 0;
  success_rate NUMERIC := 0;
  voucher_trust NUMERIC := 0;
  avg_review NUMERIC := 0;
  review_count INT := 0;
BEGIN
  SELECT * INTO u FROM skc_users WHERE id = p_user_id;
  IF u IS NULL THEN RETURN 0; END IF;

  -- ─── Layer 1: Identity (30 pts max) ───
  IF u.email_verified THEN identity_layer := identity_layer + 5; END IF;
  IF u.phone IS NOT NULL AND length(u.phone) >= 9 THEN identity_layer := identity_layer + 5; END IF;
  IF u.avatar_url IS NOT NULL THEN identity_layer := identity_layer + 5; END IF;
  IF u.student_id_card IS NOT NULL OR u.teacher_id_card IS NOT NULL OR u.org_registration IS NOT NULL THEN
    identity_layer := identity_layer + 5;
  END IF;
  IF u.approval_status = 'APPROVED' THEN identity_layer := identity_layer + 5; END IF;
  IF u.wallet_address IS NOT NULL THEN identity_layer := identity_layer + 3; END IF;
  IF u.telegram_chat_id IS NOT NULL THEN identity_layer := identity_layer + 2; END IF;

  -- Institutional baseline (staff/teacher/admin get +30 minimum)
  IF u.role IN ('admin','superadmin','project_staff','rmutl_staff','teacher') THEN
    identity_layer := GREATEST(identity_layer, 30);
  END IF;

  identity_layer := LEAST(30, identity_layer);

  -- ─── Layer 2: Track Record (40 pts max) ───
  IF u.role = 'student' THEN
    SELECT COUNT(*) INTO completed_count
    FROM skc_jobs WHERE student_id = p_user_id AND status IN ('COMPLETED','CLOSED');
    SELECT COUNT(*) INTO no_show_count
    FROM skc_job_workers WHERE student_id = p_user_id AND attendance_status = 'NO_SHOW';
    SELECT COUNT(*) INTO total_jobs
    FROM skc_jobs WHERE student_id = p_user_id;
  ELSIF u.role = 'employer' THEN
    SELECT COUNT(*) INTO completed_count
    FROM skc_jobs WHERE employer_id = p_user_id AND status IN ('COMPLETED','CLOSED');
    SELECT COUNT(*) INTO total_jobs
    FROM skc_jobs WHERE employer_id = p_user_id;
  END IF;

  IF total_jobs > 0 THEN success_rate := completed_count::NUMERIC / total_jobs; END IF;

  track_layer := track_layer + LEAST(15, completed_count * 1.5);  -- +1.5/job, max 15
  track_layer := track_layer + (success_rate * 10);                -- 0-10
  track_layer := track_layer - (no_show_count * 3);                -- -3/no-show

  -- Disputes lost (if dispute table exists)
  BEGIN
    SELECT COUNT(*) INTO disputes_lost_count
    FROM skc_disputes
    WHERE (raised_by = p_user_id AND status = 'REJECTED')
       OR (against_user_id = p_user_id AND status = 'RESOLVED');
    track_layer := track_layer - (disputes_lost_count * 10);
  EXCEPTION WHEN OTHERS THEN
    disputes_lost_count := 0;
  END;

  -- Institutional baseline for staff/teacher (start at +25 in track)
  IF u.role IN ('admin','superadmin','project_staff','rmutl_staff','teacher') THEN
    track_layer := GREATEST(track_layer, 25);
  END IF;

  track_layer := GREATEST(0, LEAST(40, track_layer));

  -- ─── Layer 3: Chain (20 pts max) ───
  IF u.trust_approved_by IS NOT NULL THEN
    SELECT trust_score INTO voucher_trust
    FROM skc_users WHERE id = u.trust_approved_by;
    chain_layer := COALESCE(voucher_trust, 0) * 0.2;
  ELSE
    -- No explicit voucher → small bonus if approved at all
    IF u.approval_status = 'APPROVED' THEN
      chain_layer := 5;
    END IF;
  END IF;
  chain_layer := LEAST(20, chain_layer);

  -- ─── Layer 4: Social Proof (10 pts max) ───
  BEGIN
    -- Use student_rating_summary if available
    SELECT combined_score, total_reviews INTO avg_review, review_count
    FROM skc_student_rating_summary
    WHERE student_id = p_user_id;
    IF avg_review IS NOT NULL AND review_count > 0 THEN
      social_layer := (avg_review / 5.0) * 10;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    social_layer := 0;
  END;
  social_layer := LEAST(10, social_layer);

  RETURN GREATEST(0, LEAST(100, identity_layer + track_layer + chain_layer + social_layer));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_compute_trust_score(TEXT) TO authenticated, anon;

-- =============================================================
-- 5) Compute + persist (called by API/triggers)
-- =============================================================
CREATE OR REPLACE FUNCTION fn_recompute_trust(p_user_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
  new_score NUMERIC;
  new_grade TEXT;
BEGIN
  new_score := fn_compute_trust_score(p_user_id);

  IF new_score >= 90 THEN new_grade := 'SAHIH';
  ELSIF new_score >= 70 THEN new_grade := 'HASAN';
  ELSIF new_score >= 40 THEN new_grade := 'DAIF';
  ELSE new_grade := 'MAWDU';
  END IF;

  UPDATE skc_users
  SET trust_score = new_score,
      trust_grade = new_grade,
      trust_last_computed = NOW()
  WHERE id = p_user_id;

  RETURN new_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_recompute_trust(TEXT) TO authenticated;

-- =============================================================
-- 6) Backfill all existing users
-- =============================================================
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM skc_users LOOP
    PERFORM fn_recompute_trust(rec.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
