-- ============================================================================
-- TRPB Off-chain Ledger
-- ============================================================================
-- Replaces direct TRON-on-chain payments with internal accounting.
-- TRON Nile remains as audit / mirror destination only (optional).
--
-- Tables:
--   skc_trpb_balances     — current balance + held balance per user
--   skc_trpb_transactions — full audit trail of every movement
--
-- Special user_id = '__SYSTEM__' represents the project pool (1,000,000 TRPB).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Transaction type enum
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "TrpbTxType" AS ENUM (
    'MINT',           -- system pool → user (admin grant)
    'TRANSFER',       -- user → user
    'ESCROW_HOLD',    -- user balance → held (employer locks for job)
    'ESCROW_RELEASE', -- held → recipient (staff releases on completion)
    'ESCROW_REFUND',  -- held → back to original holder (cancel)
    'BURN'            -- user → void (admin correction)
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 2. Balances table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_trpb_balances" (
  user_id      TEXT PRIMARY KEY,                          -- references skc_users(id) OR '__SYSTEM__'
  balance      NUMERIC(18,2) NOT NULL DEFAULT 0,           -- spendable
  hold_balance NUMERIC(18,2) NOT NULL DEFAULT 0,           -- locked in escrow
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (balance >= 0),
  CHECK (hold_balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_trpb_balances_balance ON "skc_trpb_balances"(balance DESC);

-- ----------------------------------------------------------------------------
-- 3. Transactions table (audit trail)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_trpb_transactions" (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user    TEXT,                                       -- NULL = mint from system, or use '__SYSTEM__'
  to_user      TEXT,                                       -- NULL = burn / hold (when target unclear)
  amount       NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  tx_type      "TrpbTxType" NOT NULL,
  job_id       TEXT REFERENCES "skc_jobs"(id) ON DELETE SET NULL,
  reason       TEXT,
  on_chain_ref TEXT,                                       -- optional Nile TX hash for mirror
  created_by   TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trpb_tx_from ON "skc_trpb_transactions"(from_user);
CREATE INDEX IF NOT EXISTS idx_trpb_tx_to ON "skc_trpb_transactions"(to_user);
CREATE INDEX IF NOT EXISTS idx_trpb_tx_job ON "skc_trpb_transactions"(job_id);
CREATE INDEX IF NOT EXISTS idx_trpb_tx_created ON "skc_trpb_transactions"(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Initialize SYSTEM pool — 1,000,000 TRPB
-- ----------------------------------------------------------------------------

INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
VALUES ('__SYSTEM__', 1000000, 0)
ON CONFLICT (user_id) DO NOTHING;

-- Initialize 0-balance for existing users (idempotent)
INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
SELECT id, 0, 0 FROM "skc_users"
WHERE id NOT IN (SELECT user_id FROM "skc_trpb_balances")
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Auto-create balance row when a new user is added
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
-- 6. Helper function: atomic transfer (caller should wrap in transaction)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_trpb_transfer(
  p_from        TEXT,
  p_to          TEXT,
  p_amount      NUMERIC,
  p_tx_type     "TrpbTxType",
  p_job_id      TEXT DEFAULT NULL,
  p_reason      TEXT DEFAULT NULL,
  p_created_by  TEXT DEFAULT NULL,
  p_on_chain_ref TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_from_balance NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  -- Validate source has enough (skip for MINT which creates new tokens from SYSTEM pool)
  IF p_from IS NOT NULL THEN
    SELECT balance INTO v_from_balance FROM "skc_trpb_balances" WHERE user_id = p_from FOR UPDATE;
    IF v_from_balance IS NULL THEN
      RAISE EXCEPTION 'source balance row not found for %', p_from;
    END IF;
    IF v_from_balance < p_amount THEN
      RAISE EXCEPTION 'insufficient balance: % has %, needs %', p_from, v_from_balance, p_amount;
    END IF;
    -- Decrement source
    UPDATE "skc_trpb_balances"
       SET balance = balance - p_amount, updated_at = NOW()
     WHERE user_id = p_from;
  END IF;

  -- Increment destination (if any)
  IF p_to IS NOT NULL THEN
    INSERT INTO "skc_trpb_balances" (user_id, balance, hold_balance)
    VALUES (p_to, p_amount, 0)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = "skc_trpb_balances".balance + p_amount,
          updated_at = NOW();
  END IF;

  -- Log transaction
  INSERT INTO "skc_trpb_transactions" (from_user, to_user, amount, tx_type, job_id, reason, created_by, on_chain_ref)
  VALUES (p_from, p_to, p_amount, p_tx_type, p_job_id, p_reason, p_created_by, p_on_chain_ref)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 7. Escrow hold helper (move balance → hold_balance, same user)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_trpb_escrow_hold(
  p_holder      TEXT,         -- employer
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

-- ----------------------------------------------------------------------------
-- 8. Escrow release (held by employer → recipient)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_trpb_escrow_release(
  p_holder      TEXT,         -- employer holding the funds
  p_recipient   TEXT,         -- usually student
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

  -- Release from hold
  UPDATE "skc_trpb_balances"
     SET hold_balance = hold_balance - p_amount,
         updated_at = NOW()
   WHERE user_id = p_holder;

  -- Credit recipient
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
-- 9. RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_trpb_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_trpb_transactions" ENABLE ROW LEVEL SECURITY;

-- Balance: owner sees own, staff/admin see all
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

-- Balance: only service role / admin can write directly (functions use SECURITY DEFINER)
DROP POLICY IF EXISTS "trpb_balance_write" ON "skc_trpb_balances";
CREATE POLICY "trpb_balance_write" ON "skc_trpb_balances" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "skc_users"
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin')
    )
  );

-- Transactions: owner sees own (from/to), staff/admin see all
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

-- Refresh PostgREST schema cache so Supabase client sees new tables immediately
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 10. Verify
-- ----------------------------------------------------------------------------

SELECT 'Pool initialized' AS info, balance AS pool_balance
FROM "skc_trpb_balances" WHERE user_id = '__SYSTEM__'
UNION ALL
SELECT 'User balance rows', COUNT(*)::numeric FROM "skc_trpb_balances" WHERE user_id != '__SYSTEM__'
UNION ALL
SELECT 'Helper functions', COUNT(*)::numeric FROM pg_proc
  WHERE proname IN ('fn_trpb_transfer', 'fn_trpb_escrow_hold', 'fn_trpb_escrow_release');
