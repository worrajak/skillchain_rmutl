-- ==========================================
-- SkillChain RMUTL - Permission columns for users
-- ให้ admin กำหนดสิทธิ์เพิ่มเติมต่อ user ได้
-- Run this in Supabase SQL Editor
-- ==========================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_post_jobs BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_evaluate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve_users BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_credentials BOOLEAN NOT NULL DEFAULT false;

-- ให้สิทธิ์ default ตาม role ที่มีอยู่
UPDATE users SET can_post_jobs = true WHERE role IN ('employer', 'teacher', 'project_staff', 'rmutl_staff', 'admin', 'superadmin');
UPDATE users SET can_evaluate = true WHERE role IN ('teacher', 'project_staff', 'rmutl_staff', 'admin', 'superadmin');
UPDATE users SET can_approve_users = true WHERE role IN ('admin', 'superadmin');
UPDATE users SET can_manage_credentials = true WHERE role IN ('teacher', 'project_staff', 'admin', 'superadmin');
