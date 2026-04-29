-- ============================================================================
-- TRPB Ledger Recovery
-- ============================================================================
-- The original manual_trpb_offchain_ledger.sql appears to have partially failed
-- on this DB (SYSTEM pool = 0, fn_trpb_transfer not found in schema cache).
-- This migration is fully idempotent — safe to re-run.
--
-- Steps:
--   1. Diagnose: print what currently exists.
--   2. Ensure enum + tables exist.
--   3. Re-create all helper functions (CREATE OR REPLACE).
--   4. Re-seed SYSTEM pool if missing.
--   5. NOTIFY pgrst to refresh PostgREST schema cache so supabase.rpc() finds them.
--   6. Final verification.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Diagnose current state (read-only — won't modify anything)
-- ----------------------------------------------------------------------------

SELECT '== DIAGNOSE ==' AS step;

SELECT 'Tables' AS what,
       string_agg(table_name, ', ') AS found
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('skc_trpb_balances', 'skc_trpb_transactions');

SELECT 'TrpbTxType enum' AS what,
       (SELECT COUNT(*)::text FROM pg_type WHERE typname = 'TrpbTxType') AS found;

SELECT 'Functions' AS what,
       string_agg(proname, ', ') AS found
  FROM pg_proc
 WHERE proname IN ('fn_trpb_transfer', 'fn_trpb_escrow_hold', 'fn_trpb_escrow_release');

SELECT 'SYSTEM pool' AS what,
       COALESCE(balance::text, 'MISSING') AS found
  FROM "skc_trpb_balances" WHERE user_id = '__SYSTEM__';

-- ----------------------------------------------------------------------------
-- 2. Enum (idempotent)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "TrpbTxType" AS ENUM (
    'MINT', 'TRANSFER', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'BURN'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 3. Tables (idempotent)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_trpb_balances" (
  user_id      TEXT PRIMARY KEY,
  balance      NUMERIC(18,2) NOT NULL DEFAULT 0,
  hold_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (balance >= 0),
  CHECK (hold_balance >= 0)
);

CREATE TABLE IF NOT EXISTS "skc_trpb_transactions" (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user    TEXT,
  to_user      TEXT,
  amount       NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  tx_type      "TrpbTxType" NOT NULL,
  job_id       TEXT REFERENCES "skc_jobs"(id) ON DELETE SET NULL,
  reason       TEXT,
  on_chain_ref TEXT,
  created_by   TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trpb_balances_balance ON "skc_trpb_balances"(balance DESC);
CREATE INDEX IF NOT EXISTS idx_trpb_tx_from ON "skc_trpb_transactions"(from_user);
CREATE INDEX IF NOT EXISTS idx_trpb_tx_to ON "skc_trpb_transactions"(to_user);
CREATE INDEX IF NOT EXISTS idx_trpb_tx_job ON "skc_trpb_transactions"(job_id);
CREATE INDEX IF NOT EXISTS idx_trpb_tx_created ON "skc_trpb_transactions"(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Helper functions (CREATE OR REPLACE — overwrites broken versions)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_trpb_transfer(
  p_from         TEXT,
  p_to           TEXT,
  p_amount       NUMERIC,
  p_tx_type      "TrpbTxType",
  p_job_id       TEXT DEFAULT NULL,
  p_reason       TEXT DEFAULT NULL,
  p_created_by   TEXT DEFAULT NULL,
  p_on_chain_ref TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_from_balance NUMERIC;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;

  IF p_from IS NOT NULL THEN
    SELECT balance INTO v_from_balance FROM "skc_trpb_balances" WHERE user_id = p_from FOR UPDATE;
    IF v_from_balance IS NULL THEN
      RAISE EXCEPTION 'source balance row not found for %', p_from;
    END IF;
    IF v_from_balance < p_amount THEN
      RAISE EXCEPTION 'insufficient balance: % has %, needs %', p_from, v_from_balance, p_amount;
    END IF;
    UPDATE "skc_trpb_balances"
       SET balance = balance - p_amount, updated_at = NOW()
     WHERE user_id = p_from;
  END IF;

  IF p_to IS NOT NULL THEN
    INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
    VALUES (p_to, p_amount, 0)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = "skc_trpb_balances".balance + p_amount,
          updated_at = NOW();
  END IF;

  INSERT INTO "skc_trpb_transactions" (from_user, to_user, amount, tx_type, job_id, reason, created_by, on_chain_ref)
  VALUES (p_from, p_to, p_amount, p_tx_type, p_job_id, p_reason, p_created_by, p_on_chain_ref)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_trpb_escrow_hold(
  p_holder      TEXT,
  p_amount      NUMERIC,
  p_job_id      TEXT,
  p_created_by  TEXT
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_balance NUMERIC;
BEGIN
  SELECT balance INTO v_balance FROM "skc_trpb_balances" WHERE user_id = p_holder FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient balance for escrow hold: % has %, needs %', p_holder, COALESCE(v_balance, 0), p_amount;
  END IF;

  UPDATE "skc_trpb_balances"
     SET balance = balance - p_amount,
         hold_balance = hold_balance + p_amount,
         updated_at = NOW()
   WHERE user_id = p_holder;

  INSERT INTO "skc_trpb_transactions" (from_user, to_user, amount, tx_type, job_id, reason, created_by)
  VALUES (p_holder, NULL, p_amount, 'ESCROW_HOLD', p_job_id, 'กัน TRPB เข้าระบบ escrow', p_created_by)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_trpb_escrow_release(
  p_holder      TEXT,
  p_recipient   TEXT,
  p_amount      NUMERIC,
  p_job_id      TEXT,
  p_created_by  TEXT
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_hold NUMERIC;
BEGIN
  SELECT hold_balance INTO v_hold FROM "skc_trpb_balances" WHERE user_id = p_holder FOR UPDATE;
  IF v_hold IS NULL OR v_hold < p_amount THEN
    RAISE EXCEPTION 'insufficient hold_balance: % has held %, needs %', p_holder, COALESCE(v_hold, 0), p_amount;
  END IF;

  UPDATE "skc_trpb_balances"
     SET hold_balance = hold_balance - p_amount,
         updated_at = NOW()
   WHERE user_id = p_holder;

  INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
  VALUES (p_recipient, p_amount, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = "skc_trpb_balances".balance + p_amount,
        updated_at = NOW();

  INSERT INTO "skc_trpb_transactions" (from_user, to_user, amount, tx_type, job_id, reason, created_by)
  VALUES (p_holder, p_recipient, p_amount, 'ESCROW_RELEASE', p_job_id, 'จ่ายค่าจ้างจาก escrow', p_created_by)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. Auto-create balance row trigger (idempotent)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_init_trpb_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_trpb_balance ON "skc_users";
CREATE TRIGGER trg_init_trpb_balance
  AFTER INSERT ON "skc_users"
  FOR EACH ROW
  EXECUTE FUNCTION fn_init_trpb_balance();

-- ----------------------------------------------------------------------------
-- 6. Re-seed SYSTEM pool if missing (or top up to 1M if zeroed)
-- ----------------------------------------------------------------------------

INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
VALUES ('__SYSTEM__', 1000000, 0)
ON CONFLICT (user_id) DO UPDATE
  SET balance = GREATEST("skc_trpb_balances".balance, 1000000),
      updated_at = NOW();

-- Initialize 0-balance rows for existing users
INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
SELECT id, 0, 0 FROM "skc_users"
WHERE id NOT IN (SELECT user_id FROM "skc_trpb_balances")
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. RLS Policies (idempotent)
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_trpb_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_trpb_transactions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trpb_balance_read" ON "skc_trpb_balances";
CREATE POLICY "trpb_balance_read" ON "skc_trpb_balances" FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR user_id = '__SYSTEM__'
    OR EXISTS (
      SELECT 1 FROM "skc_users"
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "trpb_balance_write" ON "skc_trpb_balances";
CREATE POLICY "trpb_balance_write" ON "skc_trpb_balances" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "skc_users"
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "trpb_tx_read" ON "skc_trpb_transactions";
CREATE POLICY "trpb_tx_read" ON "skc_trpb_transactions" FOR SELECT
  USING (
    from_user = auth.uid()::text
    OR to_user = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM "skc_users"
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

-- ----------------------------------------------------------------------------
-- 8. CRITICAL: refresh PostgREST schema cache so supabase.rpc() sees functions
-- ----------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 9. Final verification
-- ----------------------------------------------------------------------------

SELECT '== AFTER FIX ==' AS step;

SELECT 'Pool balance' AS check, balance::text AS value
  FROM "skc_trpb_balances" WHERE user_id = '__SYSTEM__'
UNION ALL
SELECT 'User balance rows', COUNT(*)::text FROM "skc_trpb_balances" WHERE user_id != '__SYSTEM__'
UNION ALL
SELECT 'Helper functions', COUNT(*)::text FROM pg_proc
  WHERE proname IN ('fn_trpb_transfer', 'fn_trpb_escrow_hold', 'fn_trpb_escrow_release')
UNION ALL
SELECT 'TrpbTxType enum', COUNT(*)::text FROM pg_type WHERE typname = 'TrpbTxType';

-- Expected:
-- Pool balance       1000000
-- User balance rows  (>= 1, depends on how many users you have)
-- Helper functions   3
-- TrpbTxType enum    1
