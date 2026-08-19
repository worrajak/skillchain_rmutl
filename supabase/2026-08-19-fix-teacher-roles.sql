-- แก้บัญชีอาจารย์ที่ลงทะเบียนมาเป็นนักศึกษา
-- 2026-08-19
--
-- อาจารย์ 2 ท่านสมัครแล้วได้ role 'student' เพราะตอนนั้น dropdown บทบาท
-- แสดงค่า enum ดิบ ("student") และตั้งเป็นค่าเริ่มต้น แก้ที่หน้าลงทะเบียน
-- แล้วใน commit 994849b (แสดงชื่อไทย) และ 93716da (การ์ดเลือกบทบาท)
--
-- ทั้งสองบัญชีมีคอลัมน์ name ว่าง เพราะ trigger เดิมใช้ COALESCE ที่หยุดที่
-- ค่าแรกที่ไม่ใช่ NULL — เมื่อ metadata ส่งสตริงว่างมา fallback จึงไม่ทำงาน
-- แก้ที่ trigger แล้วใน 2026-08-19-signup-trigger-keep-profile-fields.sql
--
-- ตารางคือ public.skc_users (@@map ใน prisma/schema.prisma:77)
-- สิทธิ์มาจาก skc_role_permissions ตาม role ตอนอ่านค่า — แก้คอลัมน์ role พอ
--
-- วิธีใช้: รันทีละบล็อก ตรวจผลก่อนไปบล็อกถัดไป

-- ═══════════════════════════════════════════════════════════════
-- บล็อก 1 · ดูสถานะปัจจุบันของทั้ง 3 บัญชี
-- ═══════════════════════════════════════════════════════════════
SELECT id, email, name, role, campus, faculty, teacher_id_card,
       approval_status, is_active, created_at
FROM public.skc_users
WHERE email IN (
  'montri@rmutl.ac.th',
  'nattawat@rmutl.ac.th',
  'montri.ngaodat@gmail.com'
)
ORDER BY created_at;

-- ตรวจ approval_status ด้วย — ถ้ายัง PENDING ต้องอนุมัติแยกต่างหาก
-- (ผ่านหน้า /admin/approvals หรือเพิ่มใน UPDATE บล็อก 2)


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 2 · ตั้ง role และข้อมูลให้อาจารย์ 2 ท่าน
-- ═══════════════════════════════════════════════════════════════
BEGIN;

-- ผศ.มนตรี เงาเดช · วิศวกรรมไฟฟ้า คณะวิศวกรรมศาสตร์
UPDATE public.skc_users
SET role       = 'teacher'::"UserRole",
    name       = 'ผศ.มนตรี เงาเดช',
    faculty    = 'คณะวิศวกรรมศาสตร์ สาขาวิศวกรรมไฟฟ้า',
    updated_at = NOW()
WHERE email = 'montri@rmutl.ac.th';

-- ณัฐวัฒน์ พัลวัล (Nattawat Panlawan) · วิศวกรรมไฟฟ้า คณะวิศวกรรมศาสตร์
UPDATE public.skc_users
SET role       = 'teacher'::"UserRole",
    name       = 'ณัฐวัฒน์ พัลวัล',
    faculty    = 'คณะวิศวกรรมศาสตร์ สาขาวิศวกรรมไฟฟ้า',
    updated_at = NOW()
WHERE email = 'nattawat@rmutl.ac.th';

-- ตรวจว่าได้ 2 แถวและถูกต้องก่อน COMMIT
SELECT email, name, role, faculty, approval_status, is_active
FROM public.skc_users
WHERE email IN ('montri@rmutl.ac.th', 'nattawat@rmutl.ac.th');

COMMIT;
-- ROLLBACK; ถ้าผลไม่ถูก

-- หมายเหตุ: teacher_id_card ยังว่าง เพราะตอนสมัครเลือกเป็นนักศึกษา
-- ฟอร์มจึงไม่ได้ถามช่องนั้น — ให้อาจารย์กรอกเองในหน้าโปรไฟล์ภายหลัง


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 3 · ปิดบัญชีซ้ำของ ผศ.มนตรี
-- ═══════════════════════════════════════════════════════════════
-- montri.ngaodat@gmail.com (17 ก.ค.) เป็นบัญชีที่สมัครซ้ำ หลังบัญชี
-- montri@rmutl.ac.th (24 มิ.ย.) ยังไม่ได้รับการอนุมัติ
-- ปิดการใช้งานแทนการลบ เพื่อไม่ให้กระทบแถวอื่นที่อาจอ้างถึง id นี้

-- ตรวจก่อนว่าบัญชีนี้ยังไม่ได้ผูกกับงาน/การประเมินใด ๆ
SELECT
  (SELECT COUNT(*) FROM public.skc_jobs
    WHERE student_id = u.id OR employer_id = u.id OR mentor_id = u.id) AS jobs,
  (SELECT COUNT(*) FROM public.skc_evaluations
    WHERE teacher_id = u.id OR student_id = u.id)                      AS evaluations
FROM public.skc_users u
WHERE u.email = 'montri.ngaodat@gmail.com';

-- ถ้าทั้งสองค่าเป็น 0 ค่อยรัน UPDATE นี้
BEGIN;

UPDATE public.skc_users
SET is_active  = FALSE,
    updated_at = NOW()
WHERE email = 'montri.ngaodat@gmail.com';

SELECT email, name, role, is_active FROM public.skc_users
WHERE email = 'montri.ngaodat@gmail.com';

COMMIT;
-- ROLLBACK; ถ้าผลไม่ถูก


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 4 · หาคนอื่นที่อาจสมัครผิดบทบาทแบบเดียวกัน
-- ═══════════════════════════════════════════════════════════════
-- บัญชีอีเมลมหาวิทยาลัยที่ role เป็น student แต่ไม่มีรหัสนักศึกษา
-- และไม่ใช่รูปแบบอีเมลนักศึกษา (@live.rmutl.ac.th)
SELECT id, email, name, role, faculty, student_id_card, created_at
FROM public.skc_users
WHERE role = 'student'
  AND email LIKE '%@rmutl.ac.th'
  AND email NOT LIKE '%@live.rmutl.ac.th'
  AND COALESCE(student_id_card, '') = ''
ORDER BY created_at;

-- บัญชีที่ยังไม่มีชื่อ — ผลจากบั๊ก COALESCE ใน trigger เดิม
SELECT id, email, name, role, created_at
FROM public.skc_users
WHERE COALESCE(name, '') = ''
ORDER BY created_at;

-- ดูว่า role teacher ได้สิทธิ์อะไรบ้าง
SELECT role, permission_code
FROM public.skc_role_permissions
WHERE role = 'teacher'
ORDER BY permission_code;
