# Roles & Permissions

ระบบมี 8 role (`UserRole`) ทุก role ผ่าน `approval_status` ก่อนใช้งานเต็ม

| Role | คำอธิบาย | สิทธิ์หลัก |
|---|---|---|
| `student` | นักศึกษา มทร.ล้านนา | สมัครงาน, ส่งงาน, รับเงิน, สะสม credential |
| `employer` | ผู้ว่าจ้างภายนอก | เปิดงาน, lock Escrow, ประเมินนักศึกษา |
| `teacher` | อาจารย์ | ประเมินคุณภาพงาน, รับรอง Level 3 |
| `donor` | ผู้บริจาค | บริจาคเข้ากองทุน, ดูรายงาน |
| `project_staff` | ทีมใต้ร่มพระบารมี | จับคู่งาน, รับรอง Level 2, ดูแลโครงการ |
| `rmutl_staff` | ทีม มทร.ล้านนา | ผู้ว่าจ้างเทียม (MODE_B), ประเมิน, supervisor |
| `admin` | แอดมินระบบ | จัดการผู้ใช้, อนุมัติบัญชี, ดู audit |
| `superadmin` | ผู้ดูแลสูงสุด | ทุกสิทธิ์ + ตั้งค่าระบบ |

## Approval Flow

`PENDING` → admin/staff ตรวจ → `APPROVED` / `REJECTED` / `SUSPENDED`

- `approved_by` เก็บ user id ผู้อนุมัติ
- `approved_at` เก็บเวลา
- บัญชีที่ยังไม่ approve เข้า dashboard ของ role ไม่ได้ (กั้นใน `middleware.ts`)

## Route Protection

ดู `src/middleware.ts` — แต่ละ path prefix ผูกกับ role ที่อนุญาต เช่น
- `/student/*` → `student`
- `/employer/*` → `employer`
- `/admin/*` → `admin`, `superadmin`
- `/teacher/*` → `teacher`
- `/project-staff/*` → `project_staff`
