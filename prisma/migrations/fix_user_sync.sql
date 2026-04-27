-- ============================================================================
-- Fix User Sync — เลือกใช้ทีละ section ตามที่ต้องการ
-- ============================================================================
-- ⚠️ DANGER: ทำ backup ก่อนรันเสมอ
-- ⚠️ Section A และ B ทำงานคนละแบบ — ห้ามรันทั้งคู่
-- ============================================================================


-- ============================================================================
-- SECTION A: รีเซ็ตทั้งหมด (เริ่มต้นใหม่ — ลบทุกอย่าง)
-- ============================================================================
-- ใช้เมื่อ: อยากเริ่มใหม่ทั้งระบบ ทดสอบสมัครใหม่ตั้งแต่ต้น
-- ⚠️ WARNING: จะลบข้อมูลทุกคนรวมถึง admin
-- ----------------------------------------------------------------------------

-- A.1 ลบ public data ทั้งหมด (CASCADE จะลบทุกอย่างที่ FK reference skc_users)
-- TRUNCATE public.skc_users CASCADE;

-- A.2 ลบ auth.users ต้องผ่าน Supabase Dashboard:
--    Dashboard → Authentication → Users → Select all → Delete
--
-- หรือถ้ามี service role:
-- DELETE FROM auth.users;
--
-- (ปกติจะ block ด้วย policy แต่ service role ผ่านได้)


-- ============================================================================
-- SECTION B: Sync — ทำให้ทั้ง 2 ตารางตรงกัน (เก็บข้อมูล auth ไว้)
-- ============================================================================
-- ใช้เมื่อ: public.skc_users หาย แต่ auth.users ยังมี → สร้าง public.skc_users ใหม่
-- ----------------------------------------------------------------------------

-- B.1 สร้าง public.skc_users สำหรับ orphan auth.users (default role: student)
INSERT INTO public.skc_users (id, email, name, role, approval_status, is_active, email_verified, created_at, updated_at)
SELECT
  au.id::text,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    CONCAT_WS(' ',
      au.raw_user_meta_data->>'first_name',
      au.raw_user_meta_data->>'last_name'
    ),
    SPLIT_PART(au.email, '@', 1)
  ) AS name,
  'student'::"UserRole" AS role,
  'PENDING'::"ApprovalStatus" AS approval_status,
  TRUE AS is_active,
  au.email_confirmed_at IS NOT NULL AS email_verified,
  au.created_at,
  NOW() AS updated_at
FROM auth.users au
LEFT JOIN public.skc_users pu ON au.id::text = pu.id
WHERE pu.id IS NULL
  AND au.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- B.2 ลบ orphan public.skc_users (มี profile แต่ไม่มี auth)
DELETE FROM public.skc_users pu
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id::text = pu.id AND au.deleted_at IS NULL
);


-- ============================================================================
-- SECTION C: ลบเฉพาะ user เดียว (สำหรับทดสอบ)
-- ============================================================================
-- ใช้เมื่อ: อยากลบ user เดียวเพื่อสมัครใหม่ด้วย email เดียวกัน
-- ----------------------------------------------------------------------------

-- C.1 หา user id จาก email
-- SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- C.2 ลบจาก public.skc_users (CASCADE จะลบ FK ที่เกี่ยวข้องทั้งหมด)
-- DELETE FROM public.skc_users WHERE email = 'your-email@example.com';

-- C.3 ลบจาก auth.users (ใช้ Dashboard หรือ service role)
-- DELETE FROM auth.users WHERE email = 'your-email@example.com';


-- ============================================================================
-- SECTION D: สร้าง Auto-Sync Trigger (ป้องกันปัญหานี้ในอนาคต)
-- ============================================================================
-- เมื่อมี user สมัครใหม่ใน auth.users → auto-create public.skc_users
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.skc_users (
    id,
    email,
    name,
    role,
    approval_status,
    is_active,
    email_verified,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      CONCAT_WS(' ',
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
      ),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE((NEW.raw_user_meta_data->>'role')::"UserRole", 'student'::"UserRole"),
    'PENDING'::"ApprovalStatus",
    TRUE,
    NEW.email_confirmed_at IS NOT NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ติดตั้ง trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- SECTION E: ตรวจสอบ FK constraints — ลบ user ติดตรงไหน?
-- ============================================================================
-- ใช้เมื่อ: ลบ user ไม่ได้เพราะ FK constraint
-- ----------------------------------------------------------------------------

-- หาตารางที่ FK reference skc_users
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'skc_users'
  AND ccu.table_schema = 'public'
ORDER BY tc.table_name;
