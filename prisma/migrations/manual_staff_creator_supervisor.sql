-- Staff-created jobs: auto-assign approved_by_staff = employer_id
-- ตอน new-job-form มี bug เก่า: ไม่ set approved_by_staff ตอนสร้างงาน
-- ทำให้ staff ที่สร้างงานเอง กลายเป็น "งานไม่มีผู้กำกับ" ใน dashboard
--
-- Fix:
--   (1) new-job-form.tsx ใหม่ — set approved_by_staff = userId ถ้า creator เป็น staff
--   (2) Migration นี้ — backfill ข้อมูลเก่า

UPDATE skc_jobs j
SET approved_by_staff = j.employer_id
FROM skc_users u
WHERE u.id = j.employer_id
  AND u.role IN ('project_staff', 'rmutl_staff', 'admin', 'superadmin', 'teacher')
  AND j.approved_by_staff IS NULL
  AND j.status NOT IN ('CANCELLED', 'CLOSED', 'COMPLETED');

-- Verify (run separately):
--   SELECT id, title, status, approved_by_staff IS NULL AS unsupervised
--   FROM skc_jobs j
--   LEFT JOIN skc_users u ON u.id = j.employer_id
--   WHERE u.role IN ('project_staff', 'rmutl_staff', 'admin', 'superadmin', 'teacher')
--     AND j.status IN ('OPEN', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS');
