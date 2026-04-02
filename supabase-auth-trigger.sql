-- ==========================================
-- SkillChain RMUTL - Auto-create user profile
-- เมื่อ Supabase Auth สร้าง user → สร้างแถวใน public.users อัตโนมัติ
-- Run this in Supabase SQL Editor (รันซ้ำได้)
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');

  INSERT INTO public.users (
    id, email, name, role, campus,
    approval_status,
    student_id_card, faculty, year_level,
    organization, org_registration, org_address,
    staff_position, teacher_id_card,
    is_active, email_verified,
    can_post_jobs, can_evaluate, can_approve_users, can_manage_credentials
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    v_role::"UserRole",
    COALESCE(NEW.raw_user_meta_data->>'campus', 'huaykaew'),
    'PENDING'::"ApprovalStatus",
    NEW.raw_user_meta_data->>'student_id_card',
    NEW.raw_user_meta_data->>'faculty',
    (NEW.raw_user_meta_data->>'year_level')::INTEGER,
    NEW.raw_user_meta_data->>'organization',
    NEW.raw_user_meta_data->>'org_registration',
    NEW.raw_user_meta_data->>'org_address',
    NEW.raw_user_meta_data->>'staff_position',
    NEW.raw_user_meta_data->>'teacher_id_card',
    true,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    -- สิทธิ์ default ตาม role
    v_role IN ('employer','teacher','project_staff','rmutl_staff','admin','superadmin'),
    v_role IN ('teacher','project_staff','rmutl_staff','admin','superadmin'),
    v_role IN ('admin','superadmin'),
    v_role IN ('teacher','project_staff','admin','superadmin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ลบ trigger เก่า แล้วสร้างใหม่
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- Sync user ที่ลงทะเบียนไปแล้วแต่ยังไม่มีใน public.users
-- ==========================================
INSERT INTO public.users (
  id, email, name, role, campus, approval_status,
  is_active, email_verified,
  can_post_jobs, can_evaluate, can_approve_users, can_manage_credentials
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', ''),
  COALESCE(au.raw_user_meta_data->>'role', 'student')::"UserRole",
  COALESCE(au.raw_user_meta_data->>'campus', 'huaykaew'),
  'PENDING'::"ApprovalStatus",
  true,
  COALESCE(au.email_confirmed_at IS NOT NULL, false),
  COALESCE(au.raw_user_meta_data->>'role', 'student') IN ('employer','teacher','project_staff','rmutl_staff','admin','superadmin'),
  COALESCE(au.raw_user_meta_data->>'role', 'student') IN ('teacher','project_staff','rmutl_staff','admin','superadmin'),
  COALESCE(au.raw_user_meta_data->>'role', 'student') IN ('admin','superadmin'),
  COALESCE(au.raw_user_meta_data->>'role', 'student') IN ('teacher','project_staff','admin','superadmin')
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;
