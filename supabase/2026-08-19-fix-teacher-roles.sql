-- แก้ role ของอาจารย์ที่ลงทะเบียนมาเป็น student
-- 2026-08-19
--
-- สาเหตุ: ตอนสมัคร dropdown บทบาทแสดงค่า enum ดิบ ("student") และตั้งเป็น
-- ค่าเริ่มต้น ผู้สมัครจำนวนหนึ่งจึงไม่รู้ว่าต้องเปลี่ยน แก้ที่หน้าลงทะเบียน
-- แล้วใน commit 994849b (แสดงชื่อไทย) และ 93716da (การ์ดเลือกบทบาท)
--
-- หมายเหตุสำคัญ: trigger on_auth_user_created ตั้ง permission flag ทั้ง 4 ตัว
-- ตาม role "ตอนสมัครครั้งเดียว" การแก้คอลัมน์ role อย่างเดียวจึงไม่พอ
-- ต้องตั้ง flag ใหม่ด้วย มิฉะนั้นจะได้ role อาจารย์แต่ประเมินงานไม่ได้
--
-- วิธีใช้: รันทีละบล็อกใน Supabase SQL Editor · ตรวจผลก่อนค่อยรันบล็อกถัดไป

-- ═══════════════════════════════════════════════════════════════
-- บล็อก 1 · ตรวจก่อน — ดูว่าใครบ้างที่จะโดนแก้ (ยังไม่เปลี่ยนอะไร)
-- ═══════════════════════════════════════════════════════════════
SELECT
  id, email, name, role, campus, approval_status,
  teacher_id_card, faculty,
  can_post_jobs, can_evaluate, can_approve_users, can_manage_credentials,
  created_at
FROM public.users
WHERE email ILIKE '%montri%'
   OR email ILIKE '%nattawat%'
   OR name  ILIKE '%มนตรี%'
   OR name  ILIKE '%ณัฐวัฒน%'
ORDER BY created_at;

-- ตรวจให้แน่ใจว่า:
--   1. เจอครบ 2 คน และไม่มีคนอื่นติดมาด้วย
--   2. role ปัจจุบันเป็น 'student' จริง
--   3. จด id ทั้งสองไว้ แล้วใช้ id ในบล็อก 2 แทนการ match ด้วยชื่อ/อีเมล


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 2 · แก้จริง — แทน id ที่จดไว้ก่อนรัน
-- ═══════════════════════════════════════════════════════════════
-- ตั้ง role พร้อม permission flag ให้ตรงกับที่ trigger จะให้อาจารย์
-- (อ้างอิง supabase-auth-trigger.sql บรรทัด 40-43)

BEGIN;

UPDATE public.users
SET
  role                   = 'teacher'::"UserRole",
  can_post_jobs          = true,   -- teacher อยู่ในชุดที่โพสงานได้
  can_evaluate           = true,   -- teacher ประเมินงานได้
  can_approve_users      = false,  -- เฉพาะ admin/superadmin
  can_manage_credentials = true,   -- teacher ออกใบรับรองได้
  updated_at             = NOW()
WHERE id IN (
  -- ใส่ id จากบล็อก 1 ที่นี่
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

-- ตรวจว่าได้ 2 แถวก่อน COMMIT — ถ้าไม่ใช่ ให้ ROLLBACK
SELECT id, email, name, role,
       can_post_jobs, can_evaluate, can_approve_users, can_manage_credentials
FROM public.users
WHERE id IN (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

COMMIT;
-- ถ้าผลไม่ถูกต้อง: ROLLBACK;


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 3 · ตรวจหาคนอื่นที่อาจสมัครผิดแบบเดียวกัน
-- ═══════════════════════════════════════════════════════════════
-- student ที่กรอก teacher_id_card หรือ staff_position มา = สัญญาณว่าเลือก
-- บทบาทผิด เพราะช่องพวกนี้จะโผล่เฉพาะเมื่อเลือก role นั้น ๆ
SELECT id, email, name, role, teacher_id_card, staff_position, faculty, created_at
FROM public.users
WHERE role = 'student'
  AND (
    COALESCE(teacher_id_card, '') <> ''
    OR COALESCE(staff_position, '') <> ''
  )
ORDER BY created_at;

-- student ที่ไม่มีรหัสนักศึกษาเลย — อาจไม่ใช่นักศึกษาจริง
SELECT id, email, name, role, student_id_card, faculty, created_at
FROM public.users
WHERE role = 'student'
  AND COALESCE(student_id_card, '') = ''
ORDER BY created_at;
