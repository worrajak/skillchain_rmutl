-- ============================================================================
-- Schema State Diagnostic — ตรวจสอบสถานะ database ทั้งหมด
-- ============================================================================

-- 1. ตารางใน public schema ที่เหลืออยู่
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. นับจำนวนตารางทั้งหมด
SELECT COUNT(*) AS public_table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- 3. ตรวจสอบ enums (custom types) ที่มีอยู่
SELECT
  t.typname AS enum_name,
  ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- 4. นับจำนวน auth.users ที่ยังเหลืออยู่
SELECT
  COUNT(*) AS total_auth_users,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_auth_users,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted_auth_users
FROM auth.users;

-- 5. รายชื่อ email ใน auth.users (ที่จะติดตอนสมัครใหม่)
SELECT
  email,
  email_confirmed_at IS NOT NULL AS confirmed,
  created_at,
  deleted_at
FROM auth.users
ORDER BY created_at DESC;
