-- ============================================================================
-- Diagnostic Toolkit: ตรวจสอบความสอดคล้องระหว่าง auth.users และ public.users
-- ============================================================================
-- รันใน Supabase SQL Editor — ทุกหัวข้อรันแยกกันได้
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. นับจำนวนผู้ใช้ในแต่ละตาราง
-- ----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM auth.users)                          AS auth_users_count,
  (SELECT COUNT(*) FROM public.users)                        AS public_users_count,
  (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL) AS confirmed_count,
  (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL) AS active_auth_count;

-- ----------------------------------------------------------------------------
-- 2. รายชื่อผู้ใช้ใน auth.users (ทั้งหมด)
-- ----------------------------------------------------------------------------
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL AS confirmed,
  last_sign_in_at,
  created_at,
  deleted_at
FROM auth.users
ORDER BY created_at DESC;

-- ----------------------------------------------------------------------------
-- 3. รายชื่อผู้ใช้ใน public.users (ทั้งหมด)
-- ----------------------------------------------------------------------------
SELECT
  id,
  email,
  role,
  first_name,
  last_name,
  approval_status,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- ----------------------------------------------------------------------------
-- 4. หา ORPHAN ใน auth.users (มีใน auth แต่ไม่มีใน public)
-- → คนที่สมัครแล้วแต่ไม่มี profile = สมัครไม่สำเร็จ หรือ public.users ถูกลบ
-- ----------------------------------------------------------------------------
SELECT
  au.id,
  au.email,
  au.created_at AS auth_created_at,
  au.last_sign_in_at,
  CASE WHEN au.deleted_at IS NULL THEN 'active' ELSE 'deleted' END AS auth_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;

-- ----------------------------------------------------------------------------
-- 5. หา ORPHAN ใน public.users (มีใน public แต่ไม่มีใน auth)
-- → profile ค้าง หลังจาก admin ลบใน Supabase Dashboard
-- ----------------------------------------------------------------------------
SELECT
  pu.id,
  pu.email,
  pu.role,
  pu.first_name,
  pu.last_name,
  pu.created_at AS public_created_at
FROM public.users pu
LEFT JOIN auth.users au ON pu.id = au.id
WHERE au.id IS NULL
ORDER BY pu.created_at DESC;

-- ----------------------------------------------------------------------------
-- 6. หา EMAIL ที่ถูกใช้ซ้ำ
-- ----------------------------------------------------------------------------
SELECT
  email,
  COUNT(*) as occurrences,
  STRING_AGG(id::text, ', ') as user_ids
FROM auth.users
WHERE deleted_at IS NULL
GROUP BY email
HAVING COUNT(*) > 1;
