-- ============================================================================
-- Permissions System (Hybrid Role + Per-User Override)
-- ============================================================================
-- Default permissions ตาม role + admin grant/revoke per user ได้
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Master permissions (catalog)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_permissions" (
  code              TEXT PRIMARY KEY,                -- e.g., 'POST_JOB'
  category          TEXT NOT NULL,                   -- 'job', 'eval', 'gov', 'admin', etc.
  label_th          TEXT NOT NULL,
  label_en          TEXT,
  description_th    TEXT,
  is_dangerous      BOOLEAN DEFAULT FALSE,           -- ต้องยืนยันก่อน grant
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON "skc_permissions"(category);

-- ----------------------------------------------------------------------------
-- 2. Role default permissions
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_role_permissions" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role            TEXT NOT NULL,                     -- matches UserRole enum
  permission_code TEXT REFERENCES "skc_permissions"(code) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_role ON "skc_role_permissions"(role);

-- ----------------------------------------------------------------------------
-- 3. Per-user permission overrides (grant or revoke)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_user_permission_overrides" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT REFERENCES "skc_users"(id) ON DELETE CASCADE,
  permission_code TEXT REFERENCES "skc_permissions"(code) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('GRANT', 'REVOKE')),
  granted_by      TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  reason          TEXT,
  expires_at      TIMESTAMPTZ,                       -- NULL = no expiry
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_code, is_active) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user ON "skc_user_permission_overrides"(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_overrides_perm ON "skc_user_permission_overrides"(permission_code);

-- ----------------------------------------------------------------------------
-- 4. Audit log for permission changes
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_permission_audit_log" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  permission_code TEXT,
  action          TEXT NOT NULL,                     -- 'GRANT', 'REVOKE', 'EXPIRE'
  performed_by    TEXT REFERENCES "skc_users"(id) ON DELETE SET NULL,
  reason          TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perm_audit_user ON "skc_permission_audit_log"(user_id);
CREATE INDEX IF NOT EXISTS idx_perm_audit_created ON "skc_permission_audit_log"(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_user_permission_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_permission_audit_log" ENABLE ROW LEVEL SECURITY;

-- Permissions catalog: everyone can read
DROP POLICY IF EXISTS "perms_read_all" ON "skc_permissions";
CREATE POLICY "perms_read_all" ON "skc_permissions" FOR SELECT USING (true);

DROP POLICY IF EXISTS "perms_admin_write" ON "skc_permissions";
CREATE POLICY "perms_admin_write" ON "skc_permissions" FOR ALL
  USING (public.is_admin_role());

-- Role permissions: everyone can read, admin write
DROP POLICY IF EXISTS "role_perms_read_all" ON "skc_role_permissions";
CREATE POLICY "role_perms_read_all" ON "skc_role_permissions" FOR SELECT USING (true);

DROP POLICY IF EXISTS "role_perms_admin_write" ON "skc_role_permissions";
CREATE POLICY "role_perms_admin_write" ON "skc_role_permissions" FOR ALL
  USING (public.is_admin_role());

-- User overrides: user reads own, admin reads/writes all
DROP POLICY IF EXISTS "user_overrides_read_own" ON "skc_user_permission_overrides";
CREATE POLICY "user_overrides_read_own" ON "skc_user_permission_overrides" FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin_role());

DROP POLICY IF EXISTS "user_overrides_admin_write" ON "skc_user_permission_overrides";
CREATE POLICY "user_overrides_admin_write" ON "skc_user_permission_overrides" FOR ALL
  USING (public.is_admin_role());

-- Audit log: admin only
DROP POLICY IF EXISTS "perm_audit_admin" ON "skc_permission_audit_log";
CREATE POLICY "perm_audit_admin" ON "skc_permission_audit_log" FOR ALL
  USING (public.is_admin_role());

-- ----------------------------------------------------------------------------
-- 6. Master Permissions List
-- ----------------------------------------------------------------------------

INSERT INTO "skc_permissions" (code, category, label_th, label_en, description_th, is_dangerous, sort_order) VALUES
  -- JOB (10-19)
  ('POST_JOB',                    'job',   'สร้างงานจ้าง',                'Post Job',                      'สร้างงานใหม่ในระบบ', false, 10),
  ('APPROVE_JOB_ASSIGNMENT',      'job',   'อนุมัติให้ นศ. รับงาน',         'Approve Job Assignment',        'อนุมัติคำขอรับงานของนักศึกษา', false, 11),
  ('ASSIGN_STAFF_SUPERVISOR',     'job',   'แต่งตั้ง staff ดูแลงาน',         'Assign Staff Supervisor',       'มอบหมาย staff ให้ดูแลงาน', false, 12),
  ('RELEASE_ESCROW',              'job',   'ปล่อยเงิน Escrow',              'Release Escrow',                'อนุมัติให้ปล่อยเงินจาก smart contract', true, 13),
  ('CANCEL_JOB',                  'job',   'ยกเลิกงาน',                  'Cancel Job',                    'ยกเลิกงานก่อนเสร็จสมบูรณ์', false, 14),
  ('RESOLVE_DISPUTE',             'job',   'แก้ข้อพิพาท',                  'Resolve Dispute',               'ตัดสินข้อพิพาทระหว่างผู้ใช้', true, 15),

  -- EVALUATION (20-29)
  ('EVALUATE_AS_TEACHER',         'eval',  'ประเมินในฐานะอาจารย์',          'Evaluate as Teacher',           'ประเมินผลงาน นศ. ในฐานะอาจารย์', false, 20),
  ('REVIEW_AS_EMPLOYER',          'eval',  'รีวิวในฐานะผู้จ้าง',              'Review as Employer',            'ให้คะแนน นศ. หลังจ้างงาน', false, 21),
  ('REVIEW_AS_MENTOR',            'eval',  'รีวิวในฐานะพี่เลี้ยง',             'Review as Mentor',              'ให้คะแนน นศ. รุ่นน้องที่ดูแล', false, 22),
  ('CERTIFY_WORK',                'eval',  'รับรองการปฏิบัติงาน',            'Certify Work',                  'ลงนามรับรองงานเสร็จสมบูรณ์ (gov)', false, 23),
  ('ISSUE_CREDENTIAL',            'eval',  'ออกใบรับรองทักษะ',              'Issue Credential',              'ออก NFT credential ให้ นศ.', false, 24),
  ('AWARD_CREDITS',               'eval',  'มอบ SkillCredit',              'Award SkillCredits',            'มอบแต้มทักษะให้ นศ.', false, 25),
  ('REVOKE_CREDITS',              'eval',  'หัก SkillCredit',               'Revoke SkillCredits',           'หักแต้มทักษะ (กรณีทุจริต)', true, 26),

  -- GOV WORKFLOW (30-39)
  ('CREATE_ACTIVITY_APPROVAL',    'gov',   'จัดทำบันทึกขออนุมัติกิจกรรม',     'Create Activity Approval',      'สร้างเอกสารบันทึกข้อความขออนุมัติ', false, 30),
  ('APPROVE_ACTIVITY',            'gov',   'อนุมัติกิจกรรม',                'Approve Activity',              'ลงนามอนุมัติบันทึก (ผู้บริหาร)', false, 31),
  ('CREATE_CONTRACT',             'gov',   'จัดทำสัญญาจ้าง',                'Create Employment Contract',    'สร้างสัญญาจ้าง นศ.', false, 32),
  ('VERIFY_TIMESHEET',            'gov',   'ยืนยัน timesheet',              'Verify Timesheet',              'ยืนยันชั่วโมงทำงานของ นศ.', false, 33),
  ('CREATE_DISBURSEMENT',         'gov',   'จัดทำใบเบิกค่าตอบแทน',          'Create Disbursement',           'สร้างใบขอเบิกเงิน', false, 34),
  ('APPROVE_DISBURSEMENT_HEAD',   'gov',   'อนุมัติเบิก (หัวหน้าโครงการ)',    'Approve Disbursement (Head)',   'อนุมัติใบเบิกขั้นที่ 1', false, 35),
  ('APPROVE_DISBURSEMENT_FINANCE', 'gov',  'อนุมัติเบิก (การเงิน)',           'Approve Disbursement (Finance)', 'อนุมัติใบเบิกขั้นที่ 2', false, 36),
  ('APPROVE_DISBURSEMENT_FINAL',  'gov',   'อนุมัติเบิก (สุดท้าย)',           'Approve Disbursement (Final)',  'อนุมัติใบเบิกขั้นสุดท้าย', true, 37),
  ('RECORD_PAYMENT',              'gov',   'บันทึกการจ่ายเงินจริง',           'Record Payment',                'บันทึกว่าจ่ายเงิน นศ. แล้ว', false, 38),
  ('GENERATE_OFFICIAL_DOC',       'gov',   'สร้างเอกสารราชการ',             'Generate Official Document',    'gen เอกสาร .docx อัตโนมัติ', false, 39),

  -- USER MANAGEMENT (40-49)
  ('APPROVE_USER',                'user',  'อนุมัติผู้ใช้ใหม่',                'Approve User',                  'เปลี่ยน status PENDING → APPROVED', false, 40),
  ('MANAGE_USERS',                'user',  'จัดการข้อมูลผู้ใช้',              'Manage Users',                  'แก้ไข/ระงับ/ลบ user', false, 41),
  ('MANAGE_PERMISSIONS',          'user',  'มอบสิทธิ์ให้ผู้อื่น',              'Manage Permissions',            'grant/revoke permission ให้ user', true, 42),
  ('INVITE_USER',                 'user',  'สร้าง invitation QR',           'Create Invitation',             'สร้าง QR เชิญลงทะเบียน', false, 43),
  ('RESET_PIN',                   'user',  'รีเซ็ต PIN ของผู้อื่น',           'Reset User PIN',                'รีเซ็ต PIN 6 หลักของ user', false, 44),
  ('VIEW_USER_DETAILS',           'user',  'ดูข้อมูลผู้ใช้รายคน',             'View User Details',             'เข้าดู profile ของ user คนอื่น', false, 45),
  ('DEACTIVATE_USER',             'user',  'ระงับการใช้งาน',                'Deactivate User',               'ระงับ user ชั่วคราว', true, 46),
  ('ASSIGN_ROLE',                 'user',  'เปลี่ยนบทบาท user',             'Assign Role',                   'เปลี่ยน role เช่น student → teacher', true, 47),

  -- FUND (50-59)
  ('MANAGE_FUND',                 'fund',  'จัดการกองทุน',                  'Manage Fund',                   'อนุมัติการใช้เงินกองทุน', true, 50),
  ('VIEW_FUND_AUDIT',             'fund',  'ดู audit กองทุน',                'View Fund Audit',               'ดูประวัติการใช้กองทุน', false, 51),
  ('DONATE',                      'fund',  'บริจาคเงินกองทุน',                'Donate',                        'บริจาคเข้ากองทุน', false, 52),

  -- REPORTS (60-69)
  ('VIEW_REPORTS',                'report','ดูรายงานสรุป',                  'View Reports',                  'เข้าดู dashboard รายงาน', false, 60),
  ('VIEW_AUDIT_LOG',              'report','ดู Audit Log ระบบ',              'View Audit Log',                'ดูประวัติการเปลี่ยนแปลงระบบ', false, 61),
  ('EXPORT_DATA',                 'report','Export ข้อมูลออก',                'Export Data',                   'ส่งออกข้อมูลเป็น CSV/Excel', false, 62),

  -- SYSTEM (70-79)
  ('MANAGE_FEES',                 'sys',   'ตั้งค่าค่าธรรมเนียม',              'Manage Fee Config',             'ปรับค่า fee split ของ Escrow', true, 70),
  ('MANAGE_TIERS',                'sys',   'จัดการ Student Tier',           'Manage Student Tiers',          'กำหนดระดับ tier ของ นศ.', false, 71),
  ('MANAGE_BUDGET',               'sys',   'จัดการงบประมาณโครงการ',         'Manage Project Budget',         'ปรับงบโครงการแม่', true, 72),
  ('MANAGE_TELEGRAM',             'sys',   'จัดการ Telegram Bot',           'Manage Telegram',               'config Telegram notifications', false, 73)
ON CONFLICT (code) DO UPDATE SET
  category = EXCLUDED.category,
  label_th = EXCLUDED.label_th,
  label_en = EXCLUDED.label_en,
  description_th = EXCLUDED.description_th,
  is_dangerous = EXCLUDED.is_dangerous,
  sort_order = EXCLUDED.sort_order;

-- ----------------------------------------------------------------------------
-- 7. Default Role → Permissions mapping
-- ----------------------------------------------------------------------------

-- Clear existing
DELETE FROM "skc_role_permissions";

-- superadmin: ทุก permission
INSERT INTO "skc_role_permissions" (role, permission_code)
SELECT 'superadmin', code FROM "skc_permissions";

-- admin: ทุก permission ยกเว้น MANAGE_PERMISSIONS (ต้อง superadmin only)
INSERT INTO "skc_role_permissions" (role, permission_code)
SELECT 'admin', code FROM "skc_permissions"
WHERE code != 'MANAGE_PERMISSIONS';

-- rmutl_staff: gov workflow ระดับสูง + user mgmt
INSERT INTO "skc_role_permissions" (role, permission_code) VALUES
  ('rmutl_staff', 'APPROVE_USER'),
  ('rmutl_staff', 'MANAGE_USERS'),
  ('rmutl_staff', 'INVITE_USER'),
  ('rmutl_staff', 'RESET_PIN'),
  ('rmutl_staff', 'VIEW_USER_DETAILS'),
  ('rmutl_staff', 'CREATE_ACTIVITY_APPROVAL'),
  ('rmutl_staff', 'APPROVE_ACTIVITY'),
  ('rmutl_staff', 'CREATE_CONTRACT'),
  ('rmutl_staff', 'VERIFY_TIMESHEET'),
  ('rmutl_staff', 'CREATE_DISBURSEMENT'),
  ('rmutl_staff', 'APPROVE_DISBURSEMENT_FINANCE'),
  ('rmutl_staff', 'GENERATE_OFFICIAL_DOC'),
  ('rmutl_staff', 'RESOLVE_DISPUTE'),
  ('rmutl_staff', 'VIEW_REPORTS'),
  ('rmutl_staff', 'VIEW_AUDIT_LOG'),
  ('rmutl_staff', 'EXPORT_DATA'),
  ('rmutl_staff', 'MANAGE_BUDGET');

-- project_staff: ดูแลงาน + อนุมัติเบื้องต้น
INSERT INTO "skc_role_permissions" (role, permission_code) VALUES
  ('project_staff', 'APPROVE_USER'),
  ('project_staff', 'INVITE_USER'),
  ('project_staff', 'RESET_PIN'),
  ('project_staff', 'VIEW_USER_DETAILS'),
  ('project_staff', 'APPROVE_JOB_ASSIGNMENT'),
  ('project_staff', 'ASSIGN_STAFF_SUPERVISOR'),
  ('project_staff', 'RELEASE_ESCROW'),
  ('project_staff', 'RESOLVE_DISPUTE'),
  ('project_staff', 'CREATE_ACTIVITY_APPROVAL'),
  ('project_staff', 'VERIFY_TIMESHEET'),
  ('project_staff', 'CREATE_DISBURSEMENT'),
  ('project_staff', 'APPROVE_DISBURSEMENT_HEAD'),
  ('project_staff', 'GENERATE_OFFICIAL_DOC'),
  ('project_staff', 'RECORD_PAYMENT'),
  ('project_staff', 'CERTIFY_WORK'),
  ('project_staff', 'AWARD_CREDITS'),
  ('project_staff', 'VIEW_REPORTS'),
  ('project_staff', 'VIEW_AUDIT_LOG');

-- teacher: ประเมินและรับรอง
INSERT INTO "skc_role_permissions" (role, permission_code) VALUES
  ('teacher', 'EVALUATE_AS_TEACHER'),
  ('teacher', 'CERTIFY_WORK'),
  ('teacher', 'ISSUE_CREDENTIAL'),
  ('teacher', 'AWARD_CREDITS'),
  ('teacher', 'APPROVE_USER'),
  ('teacher', 'VIEW_USER_DETAILS'),
  ('teacher', 'VIEW_REPORTS');

-- employer: จ้างงาน + รีวิว
INSERT INTO "skc_role_permissions" (role, permission_code) VALUES
  ('employer', 'POST_JOB'),
  ('employer', 'CANCEL_JOB'),
  ('employer', 'REVIEW_AS_EMPLOYER'),
  ('employer', 'CERTIFY_WORK');

-- student: ไม่มีสิทธิ์พิเศษ (ใช้ตาม role check ปกติ)
-- (no rows)

-- donor: บริจาค + ดู audit
INSERT INTO "skc_role_permissions" (role, permission_code) VALUES
  ('donor', 'DONATE'),
  ('donor', 'VIEW_FUND_AUDIT');

-- ----------------------------------------------------------------------------
-- 8. Helper function: Get user's effective permissions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id TEXT)
RETURNS TABLE(permission_code TEXT, source TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role::text INTO v_role FROM "skc_users" WHERE id = p_user_id;

  RETURN QUERY
  WITH role_perms AS (
    -- Default permissions from role
    SELECT rp.permission_code AS code, 'role' AS source, NULL::timestamptz AS expires_at
    FROM "skc_role_permissions" rp
    WHERE rp.role = v_role
  ),
  granted AS (
    -- Explicit grants
    SELECT uo.permission_code AS code, 'granted' AS source, uo.expires_at
    FROM "skc_user_permission_overrides" uo
    WHERE uo.user_id = p_user_id
      AND uo.action = 'GRANT'
      AND uo.is_active = true
      AND (uo.expires_at IS NULL OR uo.expires_at > NOW())
  ),
  revoked AS (
    -- Explicit revocations
    SELECT uo.permission_code AS code
    FROM "skc_user_permission_overrides" uo
    WHERE uo.user_id = p_user_id
      AND uo.action = 'REVOKE'
      AND uo.is_active = true
      AND (uo.expires_at IS NULL OR uo.expires_at > NOW())
  )
  SELECT DISTINCT ON (combined.code)
    combined.code,
    combined.source,
    combined.expires_at
  FROM (
    SELECT * FROM role_perms
    UNION ALL
    SELECT * FROM granted
  ) combined
  WHERE combined.code NOT IN (SELECT code FROM revoked)
  ORDER BY combined.code, (CASE WHEN combined.source = 'granted' THEN 0 ELSE 1 END);
END;
$$;

-- Helper function: Check if user has permission
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id TEXT, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_user_permissions(p_user_id)
    WHERE permission_code = p_permission
  );
$$;
