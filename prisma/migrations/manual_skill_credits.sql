-- ============================================================================
-- SkillCredit System — Soul-Bound Credit Points
-- ============================================================================
-- Off-chain mirror ของ SkillCredit contract + level system
-- - credits ไม่สามารถโอน/แลกเงินได้ (non-transferable)
-- - ใช้ปลดล็อคระดับงานตาม lifetime_earned
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "SkillCreditReason" AS ENUM (
    'JOB_COMPLETION',
    'TRAINING_COMPLETION',
    'MENTORSHIP',
    'VOLUNTEER',
    'BONUS',
    'CORRECTION'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SkillLevel" AS ENUM (
    'TRAINEE',      -- 0-99 SC
    'APPRENTICE',   -- 100-499 SC
    'CERTIFIED',    -- 500-1999 SC
    'SENIOR',       -- 2000-4999 SC
    'EXPERT'        -- 5000+ SC
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "JobTier" AS ENUM (
    'TIER_1',   -- Any level can take
    'TIER_2',   -- Apprentice+ only
    'TIER_3',   -- Certified+ only
    'TIER_4',   -- Senior+ only
    'TIER_5'    -- Expert only
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 2. Balance mirror (sync'd from on-chain events)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_credit_balances" (
  user_id           UUID PRIMARY KEY REFERENCES "skc_users"(id) ON DELETE CASCADE,
  balance           INTEGER NOT NULL DEFAULT 0,              -- Current balance (can be revoked)
  lifetime_earned   INTEGER NOT NULL DEFAULT 0,              -- Total ever earned (for levels)
  lifetime_revoked  INTEGER NOT NULL DEFAULT 0,              -- Total revoked (audit)
  current_level     "SkillLevel" NOT NULL DEFAULT 'TRAINEE',
  last_synced_at    TIMESTAMPTZ DEFAULT NOW(),
  last_tx_hash      TEXT,                                     -- Last on-chain tx for reconciliation
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_balances_level ON "skc_credit_balances"(current_level);
CREATE INDEX IF NOT EXISTS idx_skill_balances_lifetime ON "skc_credit_balances"(lifetime_earned DESC);

-- ----------------------------------------------------------------------------
-- 3. Transaction log (mirror of on-chain events)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_credit_transactions" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES "skc_users"(id) ON DELETE CASCADE,
  tx_type           TEXT NOT NULL CHECK (tx_type IN ('AWARD', 'REVOKE')),
  amount            INTEGER NOT NULL,                         -- positive for award, positive for revoke
  reason            "SkillCreditReason",
  reason_note       TEXT,
  -- References
  job_id            UUID REFERENCES "skc_jobs"(id) ON DELETE SET NULL,
  course_id         UUID,                                     -- FK to skc_training_courses (added when exists)
  -- On-chain
  tx_hash           TEXT,
  block_number      BIGINT,
  from_address      TEXT,                                     -- minter that signed
  -- Off-chain
  awarded_by        UUID REFERENCES "skc_users"(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_tx_user ON "skc_credit_transactions"(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_tx_job ON "skc_credit_transactions"(job_id);
CREATE INDEX IF NOT EXISTS idx_skill_tx_created ON "skc_credit_transactions"(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_tx_hash ON "skc_credit_transactions"(tx_hash);

-- ----------------------------------------------------------------------------
-- 4. Add tier requirement to skc_jobs
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_jobs"
  ADD COLUMN IF NOT EXISTS required_tier "JobTier" DEFAULT 'TIER_1',
  ADD COLUMN IF NOT EXISTS credits_on_completion INTEGER DEFAULT 10;  -- SC awarded when job completes

CREATE INDEX IF NOT EXISTS idx_jobs_required_tier ON "skc_jobs"(required_tier);

-- ----------------------------------------------------------------------------
-- 5. Level thresholds config (จะปรับได้ภายหลังโดยไม่ต้องแก้ migration)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_level_config" (
  level             "SkillLevel" PRIMARY KEY,
  min_lifetime      INTEGER NOT NULL,                         -- minimum lifetime_earned
  display_name_th   TEXT NOT NULL,
  display_name_en   TEXT NOT NULL,
  icon              TEXT,                                     -- emoji or icon name
  color             TEXT,                                     -- hex color for UI
  description_th    TEXT,
  unlocks_tier      "JobTier"
);

INSERT INTO "skc_level_config" (level, min_lifetime, display_name_th, display_name_en, icon, color, description_th, unlocks_tier) VALUES
  ('TRAINEE',    0,    'ผู้ฝึกหัด',          'Trainee',     '🌱', '#94A3B8', 'ผู้เริ่มต้น — สามารถรับงานพื้นฐาน',          'TIER_1'),
  ('APPRENTICE', 100,  'ช่างฝึกหัด',         'Apprentice',  '🔧', '#60A5FA', 'ผ่านการฝึกงานพื้นฐาน — รับงานระดับกลางได้',  'TIER_2'),
  ('CERTIFIED',  500,  'ช่างที่ได้รับรอง',    'Certified',   '🏅', '#34D399', 'ช่างที่มีใบรับรอง — รับงานซ่อมบำรุงทั่วไปได้',  'TIER_3'),
  ('SENIOR',     2000, 'ช่างอาวุโส',         'Senior',      '⭐', '#FBBF24', 'ช่างเชี่ยวชาญ — รับงานยากและเป็นพี่เลี้ยงได้', 'TIER_4'),
  ('EXPERT',     5000, 'ช่างผู้เชี่ยวชาญ',    'Expert',      '💎', '#A78BFA', 'ผู้เชี่ยวชาญระดับสูงสุด — รับงานทุกระดับ',      'TIER_5')
ON CONFLICT (level) DO UPDATE SET
  min_lifetime = EXCLUDED.min_lifetime,
  display_name_th = EXCLUDED.display_name_th,
  display_name_en = EXCLUDED.display_name_en,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  description_th = EXCLUDED.description_th,
  unlocks_tier = EXCLUDED.unlocks_tier;

-- ----------------------------------------------------------------------------
-- 6. Auto-recalc level trigger (when balance changes)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_recalc_skill_level()
RETURNS TRIGGER AS $$
DECLARE
  v_new_level "SkillLevel";
BEGIN
  -- Determine level based on lifetime_earned (not current balance — ensures level never drops)
  IF NEW.lifetime_earned >= 5000 THEN v_new_level := 'EXPERT';
  ELSIF NEW.lifetime_earned >= 2000 THEN v_new_level := 'SENIOR';
  ELSIF NEW.lifetime_earned >= 500 THEN v_new_level := 'CERTIFIED';
  ELSIF NEW.lifetime_earned >= 100 THEN v_new_level := 'APPRENTICE';
  ELSE v_new_level := 'TRAINEE';
  END IF;

  NEW.current_level := v_new_level;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_skill_level ON "skc_credit_balances";
CREATE TRIGGER trg_recalc_skill_level
  BEFORE UPDATE OF lifetime_earned ON "skc_credit_balances"
  FOR EACH ROW
  EXECUTE FUNCTION fn_recalc_skill_level();

-- Same for INSERT
DROP TRIGGER IF EXISTS trg_recalc_skill_level_ins ON "skc_credit_balances";
CREATE TRIGGER trg_recalc_skill_level_ins
  BEFORE INSERT ON "skc_credit_balances"
  FOR EACH ROW
  EXECUTE FUNCTION fn_recalc_skill_level();

-- ----------------------------------------------------------------------------
-- 7. RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_credit_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_credit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_level_config" ENABLE ROW LEVEL SECURITY;

-- Users can see their own balance, staff can see all
DROP POLICY IF EXISTS "skill_balances_read" ON "skc_credit_balances";
CREATE POLICY "skill_balances_read" ON "skc_credit_balances" FOR SELECT
  USING (
    user_id = auth.uid()::uuid
    OR auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

-- Only admin/service role can write
DROP POLICY IF EXISTS "skill_balances_write" ON "skc_credit_balances";
CREATE POLICY "skill_balances_write" ON "skc_credit_balances" FOR ALL
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin')
    )
  );

-- Transactions: skc_users see their own, staff see all
DROP POLICY IF EXISTS "skill_tx_read" ON "skc_credit_transactions";
CREATE POLICY "skill_tx_read" ON "skc_credit_transactions" FOR SELECT
  USING (
    user_id = auth.uid()::uuid
    OR auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "skill_tx_write" ON "skc_credit_transactions";
CREATE POLICY "skill_tx_write" ON "skc_credit_transactions" FOR INSERT
  WITH CHECK (true); -- Service role only via API

-- Level config: everyone can read, admin can write
DROP POLICY IF EXISTS "skill_level_config_read" ON "skc_level_config";
CREATE POLICY "skill_level_config_read" ON "skc_level_config" FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "skill_level_config_write" ON "skc_level_config";
CREATE POLICY "skill_level_config_write" ON "skc_level_config" FOR ALL
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin')
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Initialize balances for existing skc_users
-- ----------------------------------------------------------------------------

INSERT INTO "skc_credit_balances" (user_id, balance, lifetime_earned)
SELECT id, 0, 0 FROM "skc_users"
WHERE role IN ('student')
  AND id NOT IN (SELECT user_id FROM "skc_credit_balances")
ON CONFLICT (user_id) DO NOTHING;
