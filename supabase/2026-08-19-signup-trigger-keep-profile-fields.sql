-- ให้ trigger สมัครสมาชิกเก็บข้อมูลโปรไฟล์ที่ฟอร์มถามไป
-- 2026-08-19
--
-- ปัญหา: trigger on_auth_user_created ที่รันอยู่บน production insert เพียง
-- 9 คอลัมน์ (id, email, name, role, approval_status, is_active,
-- email_verified, created_at, updated_at) หน้าลงทะเบียนถามข้อมูลเพิ่มอีก
-- 9 ช่องแล้วส่งไปใน raw_user_meta_data แต่ trigger ไม่ได้อ่าน ข้อมูลจึงหาย
-- ทุกครั้งที่มีคนสมัคร
--
-- ผลที่เกิดขึ้นแล้ว (ยืนยันกับ production 40 บัญชี):
--   · campus ตกไปใช้ค่า default 'huaykaew' ทุกคน
--   · student_id_card / faculty / year_level ว่าง 39 จาก 40
--   · teacher_id_card ว่างทั้งหมด
--
-- บั๊กที่สอง: COALESCE ของคอลัมน์ name หยุดที่ค่าแรกที่ไม่ใช่ NULL เมื่อ
-- metadata ส่งสตริงว่างมา จึงได้ชื่อว่างและ fallback ทั้ง 3 ชั้นไม่ทำงาน
-- แก้ด้วย NULLIF ทุกชั้นในบล็อก 2
--
-- ไฟล์ supabase-auth-trigger.sql ในรีโปไม่ตรงกับของจริง (ยังชี้ตาราง "users"
-- และมีคอลัมน์สิทธิ์ที่ไม่มีอยู่แล้ว) — ให้ยึดไฟล์นี้แทน
--
-- วิธีใช้: รันบล็อก 1 ดูความเสียหายก่อน แล้วค่อยรันบล็อก 2

-- ═══════════════════════════════════════════════════════════════
-- บล็อก 1 · ประเมินความเสียหาย (อ่านอย่างเดียว)
-- ═══════════════════════════════════════════════════════════════
SELECT
  COUNT(*)                                                   AS total_users,
  COUNT(*) FILTER (WHERE campus <> 'huaykaew')               AS campus_not_default,
  COUNT(student_id_card)                                     AS has_student_id,
  COUNT(faculty)                                             AS has_faculty,
  COUNT(year_level)                                          AS has_year_level,
  COUNT(teacher_id_card)                                     AS has_teacher_id,
  COUNT(organization)                                        AS has_organization
FROM public.skc_users;

-- ค่าที่เป็น 0 ทั้งแถว = ยืนยันว่าข้อมูลไม่เคยถูกบันทึกเลย
-- ข้อมูลดิบยังอยู่ใน auth.users.raw_user_meta_data กู้กลับได้ (บล็อก 3)


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 2 · แทนที่ trigger function ให้เก็บครบ
-- ═══════════════════════════════════════════════════════════════
-- คงพฤติกรรมเดิมทุกอย่าง (id::text, fallback ชื่อหลายชั้น, ON CONFLICT
-- DO NOTHING, approval_status = PENDING) เพิ่มเฉพาะคอลัมน์โปรไฟล์
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $function$
BEGIN
  INSERT INTO public.skc_users (
    id,
    email,
    name,
    role,
    campus,
    approval_status,
    is_active,
    email_verified,
    student_id_card,
    faculty,
    year_level,
    organization,
    org_registration,
    org_address,
    staff_position,
    teacher_id_card,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    -- ต้อง NULLIF ทุกชั้น เพราะ COALESCE หยุดที่ค่าแรกที่ไม่ใช่ NULL
    -- ถ้า metadata ส่งสตริงว่างมา จะได้ชื่อว่างและ fallback ไม่ทำงาน
    -- (เกิดขึ้นจริงกับบัญชี montri@ และ nattawat@ ก่อนแก้จุดนี้)
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(CONCAT_WS(' ',
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
      ), ''),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE((NEW.raw_user_meta_data->>'role')::"UserRole", 'student'::"UserRole"),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'campus', ''), 'huaykaew'),
    'PENDING'::"ApprovalStatus",
    TRUE,
    NEW.email_confirmed_at IS NOT NULL,
    NULLIF(NEW.raw_user_meta_data->>'student_id_card', ''),
    NULLIF(NEW.raw_user_meta_data->>'faculty', ''),
    NULLIF(NEW.raw_user_meta_data->>'year_level', '')::INTEGER,
    NULLIF(NEW.raw_user_meta_data->>'organization', ''),
    NULLIF(NEW.raw_user_meta_data->>'org_registration', ''),
    NULLIF(NEW.raw_user_meta_data->>'org_address', ''),
    NULLIF(NEW.raw_user_meta_data->>'staff_position', ''),
    NULLIF(NEW.raw_user_meta_data->>'teacher_id_card', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- ไม่ต้องสร้าง trigger ใหม่ — CREATE OR REPLACE FUNCTION พอ
-- เพราะ trigger on_auth_user_created ผูกกับ function นี้อยู่แล้ว

-- ทดสอบ: สมัครบัญชีทดสอบ 1 บัญชี เลือกวิทยาเขตที่ไม่ใช่ห้วยแก้ว
-- แล้วตรวจว่า campus กับ student_id_card ถูกบันทึก


-- ═══════════════════════════════════════════════════════════════
-- บล็อก 3 · กู้ข้อมูลของคนที่สมัครไปแล้ว
-- ═══════════════════════════════════════════════════════════════
-- ข้อมูลที่ trigger ทิ้งไปยังอยู่ครบใน auth.users.raw_user_meta_data
-- ดูก่อนว่ากู้ได้เท่าไร
SELECT
  u.id, u.email, u.name, u.role,
  u.campus                              AS campus_now,
  a.raw_user_meta_data->>'campus'       AS campus_original,
  a.raw_user_meta_data->>'student_id_card' AS student_id_original,
  a.raw_user_meta_data->>'faculty'      AS faculty_original,
  a.raw_user_meta_data->>'year_level'   AS year_original,
  a.raw_user_meta_data->>'teacher_id_card' AS teacher_id_original
FROM public.skc_users u
JOIN auth.users a ON a.id::text = u.id
WHERE a.raw_user_meta_data ?| array[
  'campus','student_id_card','faculty','year_level',
  'organization','org_registration','org_address',
  'staff_position','teacher_id_card'
]
ORDER BY u.created_at;

-- ถ้าผลข้างบนดูถูกต้อง ค่อยรัน UPDATE นี้เพื่อกู้กลับ
-- เขียนแบบไม่ทับค่าที่มีอยู่แล้ว (COALESCE ค่าเดิมมาก่อน)
/*
BEGIN;

UPDATE public.skc_users u
SET
  campus           = COALESCE(NULLIF(a.raw_user_meta_data->>'campus', ''), u.campus),
  student_id_card  = COALESCE(u.student_id_card,  NULLIF(a.raw_user_meta_data->>'student_id_card', '')),
  faculty          = COALESCE(u.faculty,          NULLIF(a.raw_user_meta_data->>'faculty', '')),
  year_level       = COALESCE(u.year_level,       NULLIF(a.raw_user_meta_data->>'year_level', '')::INTEGER),
  organization     = COALESCE(u.organization,     NULLIF(a.raw_user_meta_data->>'organization', '')),
  org_registration = COALESCE(u.org_registration, NULLIF(a.raw_user_meta_data->>'org_registration', '')),
  org_address      = COALESCE(u.org_address,      NULLIF(a.raw_user_meta_data->>'org_address', '')),
  staff_position   = COALESCE(u.staff_position,   NULLIF(a.raw_user_meta_data->>'staff_position', '')),
  teacher_id_card  = COALESCE(u.teacher_id_card,  NULLIF(a.raw_user_meta_data->>'teacher_id_card', '')),
  updated_at       = NOW()
FROM auth.users a
WHERE a.id::text = u.id;

-- ตรวจผลก่อน COMMIT
SELECT COUNT(*) FILTER (WHERE campus <> 'huaykaew') AS campus_fixed,
       COUNT(student_id_card)                       AS student_id_fixed,
       COUNT(teacher_id_card)                       AS teacher_id_fixed
FROM public.skc_users;

COMMIT;
-- ROLLBACK; ถ้าผลไม่ถูก
*/
