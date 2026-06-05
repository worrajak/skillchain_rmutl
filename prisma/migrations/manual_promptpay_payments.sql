-- PromptPay Payment System — Phase 1 (Donation)
--
-- Architecture: PromptPay เสริม TRPB (on-ramp/off-ramp)
-- Flow: user → gen QR → จ่ายผ่าน bank app → upload slip → easyslip verify → admin confirm → mint TRPB
--
-- Status state machine:
--   PENDING       → QR สร้างแล้ว รอจ่าย
--   SLIP_UPLOADED → user upload slip แล้ว รอ verify
--   VERIFIED      → easyslip ตรวจสอบ slip ผ่านแล้ว รอ admin confirm
--   CONFIRMED     → admin confirm + mint TRPB เข้า pool/wallet
--   FAILED        → verify ล้มเหลว หรือ admin ปฏิเสธ
--   EXPIRED       → QR หมดอายุก่อนจ่าย

CREATE TABLE IF NOT EXISTS skc_payments (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference       TEXT NOT NULL UNIQUE,  -- ระบบ gen — ใช้ match กับ slip
  payer_id        TEXT REFERENCES skc_users(id),
  payer_name      TEXT,                  -- กรณีไม่ login (anonymous donor)
  payer_note      TEXT,                  -- ข้อความฝากจาก donor
  purpose         TEXT NOT NULL DEFAULT 'donation',
  -- 'donation', 'employer_topup', 'job_payment'
  related_id      TEXT,                  -- job_id หรือ ref อื่น

  qr_payload      TEXT NOT NULL,         -- EMV-QR string ที่ promptpay-qr gen
  recipient_id    TEXT NOT NULL,         -- PromptPay ID ปลายทาง (เบอร์/เลข ปชช.)

  status          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','SLIP_UPLOADED','VERIFIED','CONFIRMED','FAILED','EXPIRED')),

  slip_url        TEXT,                  -- Supabase Storage path
  slip_uploaded_at TIMESTAMPTZ,
  verify_result   JSONB,                 -- raw response จาก easyslip
  verify_at       TIMESTAMPTZ,

  confirmed_by    TEXT REFERENCES skc_users(id),
  confirmed_at    TIMESTAMPTZ,
  rejection_reason TEXT,

  trpb_minted     NUMERIC(12,2),         -- จำนวน TRPB ที่ mint หลัง confirm
  trpb_tx_id      TEXT,                  -- ref ใน skc_trpb_transactions

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_payments_reference ON skc_payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON skc_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON skc_payments(payer_id, created_at DESC);

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE skc_payments ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (donate flow doesn't require login)
DROP POLICY IF EXISTS "payments_public_insert" ON skc_payments;
CREATE POLICY "payments_public_insert" ON skc_payments
  FOR INSERT WITH CHECK (true);

-- Payer can SELECT their own + upload slip / verify
DROP POLICY IF EXISTS "payments_payer_read" ON skc_payments;
CREATE POLICY "payments_payer_read" ON skc_payments
  FOR SELECT USING (
    payer_id IS NULL  -- anonymous
    OR payer_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM skc_users
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'project_staff', 'rmutl_staff')
    )
  );

-- Payer can update slip_url + status (before VERIFIED)
DROP POLICY IF EXISTS "payments_payer_update_slip" ON skc_payments;
CREATE POLICY "payments_payer_update_slip" ON skc_payments
  FOR UPDATE USING (
    (payer_id IS NULL OR payer_id = auth.uid()::text)
    AND status IN ('PENDING', 'SLIP_UPLOADED')
  );

-- Admin can update everything
DROP POLICY IF EXISTS "payments_admin_update" ON skc_payments;
CREATE POLICY "payments_admin_update" ON skc_payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM skc_users
      WHERE id = auth.uid()::text
        AND role IN ('admin', 'superadmin', 'project_staff', 'rmutl_staff')
    )
  );

NOTIFY pgrst, 'reload schema';
