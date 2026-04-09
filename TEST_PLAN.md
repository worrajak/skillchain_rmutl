# SkillChain RMUTL — แนวทางการทดสอบระบบ

## สภาพแวดล้อม
- Dev server: `http://localhost:3000`
- Database: Supabase (configured in `.env.local`)
- รัน dev server: `npm run dev` จาก project root

## Test Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@rmutl.ac.th | Admin1234! |
| นักศึกษา | student@test.com | Test1234! |
| ผู้ว่าจ้าง | employer@test.com | Test1234! |
| อาจารย์ | teacher@test.com | Test1234! |
| คณะทำงานใต้ร่มฯ | staff@test.com | Test1234! |
| คณะทำงาน มทร. | rmutl@test.com | Test1234! |
| ผู้บริจาค | donor@test.com | Test1234! |

---

## หมวด 1 — Authentication & Redirect

### T01 — Login แต่ละ Role redirect ถูกต้อง
| # | Role | Login ด้วย | Expected URL |
|---|---|---|---|
| T01-1 | Admin | admin@rmutl.ac.th | `/admin/dashboard` |
| T01-2 | Student | student@test.com | `/student/dashboard` |
| T01-3 | Employer | employer@test.com | `/employer/dashboard` |
| T01-4 | Teacher | teacher@test.com | `/teacher/evaluation` |
| T01-5 | Project Staff | staff@test.com | `/project-staff/approvals` |
| T01-6 | RMUTL Staff | rmutl@test.com | `/project-staff/approvals` |
| T01-7 | Donor | donor@test.com | `/donor/donate` |

**Pass criteria:** redirect ถูก URL, ไม่มี 404/500

### T02 — Route Protection
- เปิด `/admin/dashboard` โดยไม่ login → redirect ไป `/login` ✓
- เปิด `/student/dashboard` ขณะ login เป็น employer → ตรวจสอบว่าระบบรับมือยังไง

---

## หมวด 2 — Admin Portal (`/admin`)

### T03 — Dashboard
- URL: `/admin/dashboard`
- เช็ค: หน้าโหลดได้, ไม่มี error, แสดง stats

### T04 — User Management
- URL: `/admin/users`
- เช็ค: แสดงรายชื่อ users ทั้งหมด, filter ตาม role ได้

### T05 — Approvals
- URL: `/admin/approvals`
- เช็ค: แสดง pending users, ปุ่ม ยืนยัน/ปฏิเสธ ทำงาน
- ทดสอบ: ลอง register user ใหม่ → ปรากฏในรายการ pending → approve → user login ได้

### T06 — Jobs Management
- URL: `/admin/jobs`
- เช็ค: แสดงรายการ jobs ทั้งหมด

### T07 — Credentials
- URL: `/admin/credentials`
- เช็ค: หน้าโหลด, แสดง credentials ที่ออกไปแล้ว

### T08 — Fees
- URL: `/admin/fees`
- เช็ค: แสดงค่า fee split (85/5/5/5)

### T09 — Reports
- URL: `/admin/reports`
- เช็ค: หน้าโหลด

### T10 — Tier Management
- URL: `/admin/tier`
- เช็ค: แสดง tier levels (trainee/apprentice/certified)

### T11 — Disputes
- URL: `/admin/disputes`
- เช็ค: หน้าโหลด, แสดงรายการ disputes

### T12 — Reviews
- URL: `/admin/reviews`
- เช็ค: หน้าโหลด

---

## หมวด 3 — Student Portal (`/student`)

Login ด้วย: `student@test.com`

### T13 — Dashboard
- URL: `/student/dashboard`
- เช็ค: แสดง stats (jobs, credentials, tier), ไม่มี error

### T14 — Profile
- URL: `/student/profile`
- เช็ค: แสดงข้อมูลนักศึกษา (ชื่อ, รหัส, คณะ, วิทยาเขต)

### T15 — Wallet
- URL: `/student/wallet`
- เช็ค: แสดง TRPB balance (0 สำหรับ testnet), wallet address field

### T16 — Jobs
- URL: `/student/jobs`
- เช็ค: แสดงรายการ jobs ที่เปิดรับ, กดดู detail ได้

---

## หมวด 4 — Employer Portal (`/employer`)

Login ด้วย: `employer@test.com`

### T17 — Dashboard
- URL: `/employer/dashboard`
- เช็ค: หน้าโหลด, แสดง stats

### T18 — สร้าง Job ใหม่
- URL: `/employer/jobs/new`
- ทดสอบ: กรอกข้อมูล job แล้ว submit
  - ชื่องาน: "ซ่อมแซมไฟฟ้า ห้อง 101"
  - ประเภท: PAID
  - ค่าจ้าง: 500 TRPB
  - รายละเอียด: (กรอกตามต้องการ)
- **Pass criteria:** job ปรากฏในรายการ, status = OPEN

### T19 — Job List
- URL: `/employer/jobs`
- เช็ค: แสดง jobs ที่สร้างไว้, กด job เข้าดู detail ได้

### T20 — Job Detail
- URL: `/employer/jobs/[id]`
- เช็ค: แสดงรายละเอียด job, status ถูกต้อง

### T21 — Students
- URL: `/employer/students`
- เช็ค: แสดงรายชื่อ students ที่ approved

---

## หมวด 5 — Job Lifecycle (End-to-End Flow)

**ทดสอบ flow หลักของระบบ** — ต้องทำตามลำดับ:

### T22 — Full Job Flow (Mode A)

> **หมายเหตุ**: flow จริงมี schedule-proposal + dual-confirmation ที่ไม่เคยอยู่ใน test plan เดิม
> State machine จริง: `OPEN → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED`
> ไม่มี `CONFIRMED` ใน enum (ตรวจแล้วใน `prisma/schema.prisma` enum `JobStatus`)

**Step 1: Employer สร้าง Job**
- Login: employer@test.com → `/employer/jobs/new`
- สร้าง job ประเภท PAID, ใส่รายละเอียดครบ
- ตรวจสอบ: job ปรากฏใน `/employer/jobs` ด้วย status `เปิดรับ` (OPEN)

**Step 2: Student ส่งคำขอรับงาน**
- Login: student@test.com → `/student/jobs`
- หา job ที่ employer สร้าง → กด "ส่งคำขอรับงาน"
- ตรวจสอบ: toast "ส่งคำขอรับงานแล้ว — รอคณะทำงานอนุมัติ"
- หลังบ้าน: insert row ใน `job_assignment_requests` (status=PENDING); job ยังเป็น OPEN

**Step 3: Project Staff Approve คำขอ**
- Login: staff@test.com → `/project-staff/approvals`
- เห็น request ที่รอ approve → กด "อนุมัติ"
- ตรวจสอบ: request หายไปจาก list + ที่ `/project-staff/active-jobs` job ขึ้น "มอบหมายแล้ว"
- หลังบ้าน: `jobs.status = ASSIGNED`, `student_id` ถูก set, `approved_by_staff` ถูก set, `job_chat_rooms` ถูกสร้าง

**Step 4: เสนอและยืนยันวันทำงาน (student ↔ employer)**
- Student: `/student/dashboard` → การ์ดงาน → กด "เสนอวันทำงาน" → กรอก `start_date`, `end_date` → ยืนยัน
- ตรวจสอบ: toast "เสนอวันทำงานแล้ว", employer ได้รับ notification `schedule_proposed`
- Employer: `/employer/jobs/[id]` → ดู schedule ที่เสนอ → กด "ยืนยันวันทำงาน"
- ตรวจสอบ: job status = `IN_PROGRESS`

**Step 5: Student ส่งงาน**
- Login: student@test.com → `/student/dashboard` (หรือ job detail)
- กด "ส่งงาน" (ปุ่มนี้ active เฉพาะเมื่อ status=IN_PROGRESS)
- ตรวจสอบ: job status = `SUBMITTED`, employer + staff ได้รับ notification `job_submitted`

**Step 6: Dual Confirmation (Staff + Employer ยืนยันงานเสร็จ)**
- Staff: `/project-staff/active-jobs` → กด "ยืนยันงานเสร็จ" → `staff_confirmed_completion = true`
- Employer: `/employer/jobs/[id]` → กด "ยืนยันผลงาน" → `employer_confirmed_completion = true`
- **ต้องยืนยันทั้ง 2 ฝ่าย**: เมื่อครบ → job status = `COMPLETED`
- หลังบ้าน: `eval_window_start/end` ถูกตั้งโดย DB trigger

**Step 7: Evaluation**
- Employer: ให้คะแนน student (quality/punctuality/attitude) — บันทึกใน `employer_reviews`
- Student: ให้คะแนน employer (clarity/payment/safety) — บันทึกใน `student_reviews`
- (ถ้ามี) Teacher: บันทึก `evaluations` ใน POST_WORK phase
- ตรวจสอบ: คะแนนปรากฏใน `student_rating_summary` view

---

## หมวด 6 — Teacher Portal (`/teacher`)

Login ด้วย: `teacher@test.com`

### T23 — Evaluation
- URL: `/teacher/evaluation`
- เช็ค: หน้าโหลด, แสดง students รอประเมิน

### T24 — Students
- URL: `/teacher/students`
- เช็ค: แสดงรายชื่อ students

### T25 — Pending
- URL: `/teacher/pending`
- เช็ค: แสดง credentials รอออก

---

## หมวด 7 — Project Staff Portal (`/project-staff`)

Login ด้วย: `staff@test.com`

### T26 — Approvals
- URL: `/project-staff/approvals`
- เช็ค: แสดง jobs รอ approve

### T27 — Active Jobs
- URL: `/project-staff/active-jobs`
- เช็ค: แสดง jobs ที่กำลังดำเนินอยู่

### T28 — Disputes
- URL: `/project-staff/disputes`
- เช็ค: แสดง disputes ทั้งหมด

### T29 — Cancellations
- URL: `/project-staff/cancellations`
- เช็ค: แสดง jobs ที่ถูก cancel

---

## หมวด 8 — Donor Portal (`/donor`)

Login ด้วย: `donor@test.com`

### T30 — Donate
- URL: `/donor/donate`
- เช็ค: แสดงฟอร์มบริจาค, เลือก restricted/unrestricted ได้

### T31 — Audit
- URL: `/donor/audit`
- เช็ค: แสดงประวัติการบริจาค

### T32 — Impact
- URL: `/donor/impact`
- เช็ค: แสดง impact metrics

---

## หมวด 9 — Public Pages

### T33 — Job Listing (Public)
- URL: `/jobs`
- เช็ค: ดูได้โดยไม่ login, แสดง jobs ที่ status = OPEN

### T34 — About
- URL: `/about`
- เช็ค: หน้าโหลด, แสดงข้อมูลโครงการ

---

## วิธีรายงานผล

สำหรับแต่ละ test case ให้บันทึก:

```
[PASS] T01-1 Admin redirect → /admin/dashboard ✓
[FAIL] T18 สร้าง Job — error: "..."  
[SKIP] T22 Full flow — รอ job มีข้อมูลก่อน
```

---

## ลำดับความสำคัญในการทดสอบ

1. **Critical** (ต้องผ่าน): T01, T03, T05, T13, T17, T18, T22
2. **High** (สำคัญ): T04, T14, T16, T19, T23, T26, T30
3. **Medium** (ทดสอบเพิ่มเติม): ที่เหลือทั้งหมด

---

## หมายเหตุสำหรับ Claude Code

- ระบบใช้ **Next.js 16** (breaking changes จาก v14) — อ่าน `node_modules/next/dist/docs/` ก่อนแก้ไข
- Database: Prisma 7 + Supabase PostgreSQL
- Auth: Supabase SSR (cookie-based)
- Blockchain: TRON Nile Testnet (ไม่บังคับสำหรับ functional test)
- ถ้าพบ bug ให้ดู error ใน browser console + Supabase Logs → Auth/Postgres
- SQL Editor ใช้แก้ข้อมูล test ได้โดยตรงถ้าจำเป็น
