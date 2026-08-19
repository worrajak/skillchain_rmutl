-- แก้ role ของอาจารย์ที่ลงทะเบียนมาเป็น student
-- 2026-08-19
--
-- สาเหตุ: ตอนสมัคร dropdown บทบาทแสดงค่า enum ดิบ ("student") และตั้งเป็น
-- ค่าเริ่มต้น ผู้สมัครจึงไม่รู้ว่าต้องเปลี่ยน แก้ที่หน้าลงทะเบียนแล้วใน
-- commit 994849b (แสดงชื่อไทย) และ 93716da (การ์ดเลือกบทบาท)
--
-- ตารางคือ public.skc_users (ดู @@map ใน prisma/schema.prisma:77)
-- หมายเหตุ: supabase-auth-trigger.sql ยังเขียน "public.users" อยู่ ซึ่งตกรุ่น
-- ตั้งแต่ตอน rename ตาราง — อย่ายึดไฟล์นั้นเป็นแหล่งอ้างอิงชื่อตาราง/คอลัมน์
--
-- สิทธิ์: ระบบคำนวณจาก skc_role_permissions (role → permission) บวกกับ
-- override รายคน ตอนอ่านค่า ไม่ได้เก็บเป็นคอลัมน์ในตารางผู้ใช้
-- ดังนั้น "แก้คอลัมน์ role อย่างเดียวก็พอ" สิทธิ์จะตามมาเอง
--
-- วิธีใช้: รันทีละบล็อกใน Supabase SQL Editor · ตรวจผลก่อนรันบล็อกถัดไป

-- ═══════════════════════════════════════════════════════════════
-- บล็อก 1 · ตรวจก่อน — ดูว่าใครบ้างที่จะโดนแก้ (ยังไม่เปลี่ยนอะไร)
-- ═══════════════════════════════════════════════════════════════
SELECT
  id, email, name, role, campus, approval_status,
  teacher_id_card, student_id_card, faculty,
  created_at
FROM public.skc_users
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
BEGIN;

UPDATE public.skc_users
SET role       = 'teacher'::"UserRole",
    updated_at = NOW()
WHERE id IN (
  -- ใส่ id จากบล็อก 1 ที่นี่
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);

-- ตรวจว่าได้ 2 แถวและ role ถูกต้องก่อน COMMIT
SELECT id, email, name, role
FROM public.skc_users
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
FROM public.skc_users
WHERE role = 'student'
  AND (
    COALESCE(teacher_id_card, '') <> ''
    OR COALESCE(staff_position, '') <> ''
  )
ORDER BY created_at;

-- student ที่ไม่มีรหัสนักศึกษาเลย — อาจไม่ใช่นักศึกษาจริง
SELECT id, email, name, role, student_id_card, faculty, created_at
FROM public.skc_users
WHERE role = 'student'
  AND COALESCE(student_id_card, '') = ''
ORDER BY created_at;


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 4 · ตรวจว่าอาจารย์ได้สิทธิ์ครบหลังแก้
-- ═══════════════════════════════════════════════════════════════
-- ดูว่า role 'teacher' ผูกกับ permission อะไรบ้างในระบบ
SELECT role, permission_code
FROM public.skc_role_permissions
WHERE role = 'teacher'
ORDER BY permission_code;
