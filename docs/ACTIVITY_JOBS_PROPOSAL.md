# Activity/Event Jobs — Design Proposal

> รองรับ "กิจกรรมหมู่" 20-50 คน · จ่ายต่อคน fixed rate
> ขอ confirm 7 จุดก่อน implementation

---

## 1. ปัญหา / ความต้องการ

**ปัจจุบันระบบรองรับ 2 รูปแบบ:**

| Mode | จำนวนคน | ค่าจ้าง | ตัวอย่าง |
|---|---|---|---|
| งานเดี่ยว | 1 นศ. | งบรวม | ติดตั้งสายไฟ ตึก A |
| ทีม (team) | 2-20 นศ. | งบรวม → **หารเท่า ๆ กัน** | ติดตั้งระบบไฟ 3 ห้อง (3 นศ., รวม 3,000 TRPB → คนละ 900) |

**ต้องการเพิ่ม:**

| Mode | จำนวนคน | ค่าจ้าง | ตัวอย่าง |
|---|---|---|---|
| **กิจกรรมหมู่ (Activity)** | 20-50 นศ. | **รายคน fixed rate** | จิตอาสาทำความสะอาด 30 คน × 50 TRPB |

**ความต่างหลัก:**

```
Team Jobs:        งบรวม / N คน (equal split)
                  ↳ 3 นศ. ทำงานร่วมกัน, ส่งงานเดียวกัน, ค่าจ้างหาร 1/3

Activity Jobs:    rate ต่อคน × N (multiplicative)
                  ↳ 30 นศ. มาช่วยกิจกรรม, check-in รายคน, ใครมาก็ได้ 50 TRPB
                  ↳ ใครไม่มา (NO_SHOW) ก็ไม่ได้
```

---

## 2. ใครใช้ฟีเจอร์นี้

| Role | สร้างได้ | ตัวอย่าง |
|---|---|---|
| ✅ คณะทำงานใต้ร่มฯ | ใช่ | กิจกรรมจิตอาสา 30 คน · ออกค่าย |
| ✅ คณะทำงาน มทร. | ใช่ | งานพิธีระดับ ม. รับช่วย 50 คน |
| ✅ อาจารย์ | ใช่ | Workshop ห้องเรียน 25 คน · ฝึกปฏิบัติ |
| ❓ ผู้จ้างทั่วไป (employer) | ขอ confirm | งาน event ที่ต้องการช่วยหลายคน — รับได้ไหม? |
| ❌ นักศึกษา | ไม่ | (รับงานเท่านั้น) |

---

## 3. Lifecycle ต่างจาก team jobs

### Team Job (ปัจจุบัน)
```
PENDING_REVIEW → OPEN → ASSIGNED (ทีมครบ) → IN_PROGRESS
→ SUBMITTED (ส่งงานรวม) → COMPLETED → PAID
```

### Activity Job (เสนอใหม่)
```
PENDING_REVIEW
→ OPEN (เปิดรับสมัคร — staff approve ทีละคน หรือ FCFS)
→ ASSIGNED (รับครบจำนวน หรือถึงวันงาน)
→ IN_PROGRESS (วันกิจกรรมจริง — เปิด check-in)
→ COMPLETED (จบกิจกรรม — staff confirm attendance)
→ PAID (release ต่อคนสำหรับคนที่ ATTENDED)
```

ไม่มี "Submit work" — ใช้ **attendance** แทน

---

## 4. Schema เพิ่มเติม

### Option A: ขยาย skc_jobs (recommended — reuse)

```sql
ALTER TABLE skc_jobs
  ADD COLUMN engagement_mode TEXT NOT NULL DEFAULT 'SOLO'
    CHECK (engagement_mode IN ('SOLO', 'TEAM', 'ACTIVITY')),
  ADD COLUMN pay_per_person NUMERIC(10,2),  -- ถ้า ACTIVITY ใช้ค่านี้แทน pay_amount
  ADD COLUMN event_date DATE,                -- วันกิจกรรม (ACTIVITY only)
  ADD COLUMN registration_mode TEXT DEFAULT 'STAFF_APPROVE'
    CHECK (registration_mode IN ('STAFF_APPROVE', 'FCFS', 'INVITE_ONLY'));

-- ขยายจำนวนคน
ALTER TABLE skc_jobs
  DROP CONSTRAINT IF EXISTS skc_jobs_required_workers_check;
ALTER TABLE skc_jobs
  ADD CONSTRAINT skc_jobs_required_workers_check
    CHECK (required_workers BETWEEN 1 AND 100);
```

### Attendance tracking (สำคัญสำหรับ ACTIVITY)

```sql
-- เพิ่มฟิลด์ใน skc_job_workers ที่มีอยู่
ALTER TABLE skc_job_workers
  DROP CONSTRAINT IF EXISTS skc_job_workers_role_check;
ALTER TABLE skc_job_workers
  ADD CONSTRAINT skc_job_workers_role_check
    CHECK (role IN ('LEAD', 'WORKER', 'TRAINEE', 'PARTICIPANT'));

ALTER TABLE skc_job_workers
  ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'REGISTERED'
    CHECK (attendance_status IN
      ('REGISTERED','CHECKED_IN','ATTENDED','NO_SHOW','EXCUSED','PAID')),
  ADD COLUMN checked_in_at TIMESTAMPTZ,
  ADD COLUMN attended_at TIMESTAMPTZ,
  ADD COLUMN paid_amount NUMERIC(10,2),       -- เก็บยอดจ่ายต่อคน (อ้างอิงภายหลัง)
  ADD COLUMN attendance_note TEXT;
```

### Option B: ตาราง skc_activities แยก
- Pro: clean separation, ไม่ปนกับ jobs
- Con: ซ้ำซ้อน infrastructure (auth, RLS, escrow, review)

**ผมเสนอ Option A** — ขยาย skc_jobs + ใช้ `engagement_mode` แยก code path

---

## 5. UI / Form changes

### หน้า "ลงงานใหม่" — เพิ่ม section ด้านบน

```
┌───────────────────────────────────────────┐
│ ประเภทการมีส่วนร่วม                          │
│                                            │
│ ◉ งานเดี่ยว/ทีมเล็ก (1-20 คน)              │
│   ✓ ส่งงานร่วมกัน  ✓ หารค่าจ้างเท่ากัน      │
│                                            │
│ ○ กิจกรรมหมู่ (20-100 คน)                  │
│   ✓ check-in รายคน  ✓ จ่ายรายคน fixed     │
└───────────────────────────────────────────┘
```

### ถ้าเลือก "กิจกรรมหมู่"
- ✏️ "จำนวนผู้เข้าร่วม": 20-100
- ✏️ "ค่าตอบแทนต่อคน (TRPB)" — **net to student**
  - แสดง: "ทั้งหมด ≈ N × X TRPB (รวมค่าธรรมเนียม ~Y%)"
- 📅 "วันที่จัดกิจกรรม" (เปลี่ยนจาก deadline → event_date)
- ⚙️ "วิธีรับสมัคร":
  - Staff อนุมัติทีละคน (default)
  - First-come-first-served (auto-approve)
  - เฉพาะผู้ที่เชิญ (TBD: invite codes)
- ❌ ซ่อน "Mentor" + "ทีม Lead" — ไม่จำเป็น

### ส่วน Workflow (staff side)

**Approval flow:**
- ปกติ team: review งาน → staff approve นศ. ทีละคน → ทีมครบ
- Activity: review กิจกรรม → เปิด OPEN → นศ. apply → batch approve (กดอนุมัติทีละ 5-10 คน)

**Check-in (วันกิจกรรม):**
- Staff click "เปิด check-in" → status = IN_PROGRESS
- นศ. สแกน QR ของกิจกรรม → ระบบบันทึก `checked_in_at`
- หรือ staff manual tick name

**Confirm attendance (หลังกิจกรรม):**
- Staff หน้า "Attendance" → list ของ registered นศ.
- กดทีละคน: ATTENDED / NO_SHOW / EXCUSED
- หรือ bulk: "ทุกคนที่ CHECKED_IN = ATTENDED"

**Release escrow:**
- Click "ปล่อยเงิน" → ระบบหา ATTENDED ทั้งหมด → release per-person
- NO_SHOW ไม่ได้เงิน
- EXCUSED — config ได้ (ได้ครึ่ง หรือ ไม่ได้)

---

## 6. Escrow calculation

### Per-person semantics

ถ้า pay_per_person = 50 (= net to student):
- Student ได้ 50 TRPB หลังหัก fees → ผู้สร้างงานจ่าย gross 50/0.9 ≈ 55.56 → round 56

ถ้า pay_per_person = 50 (= gross):
- Total per attended student = 50 → student ได้ 50 × 0.9 = 45 (หัก fees แล้ว)

### Math example (30 นศ., 25 มาจริง)

```
pay_per_person = 50 TRPB (net = student gets 50)
gross_per_person = 50 / 0.9 ≈ 56 TRPB
attended = 25 students
total_cost = 25 × 56 = 1,400 TRPB
total_to_students = 25 × 50 = 1,250 (90%)
fund_5pct = 1,400 × 5% = 70
staff_5pct = 1,400 - 1,250 - 70 = 80

Each attended student: 50 TRPB direct
Fund pool: 70
Staff supervisor: 80
NO_SHOW (5 คน): 0
```

### On-chain mirror
สำหรับ 25 transfers — Nile testnet ใช้เวลา ~3 นาที (gas ~3 TRX)

---

## 7. คำถามที่ขอ confirm

### Q1 — Pay amount semantics
- 🅰 **50 = net to student** (ระบบ gross up ให้) — clear สำหรับ นศ.
- 🅱 50 = gross (student ได้ 45 หลังหัก)

### Q2 — Registration mode default
- 🅰 **Staff approve ทีละคน** (เหมือน team — control quality)
- 🅱 FCFS auto-approve (fast)
- 🅲 Configurable per activity

### Q3 — Attendance tracking
- 🅰 **QR check-in** (staff โพสต์ QR หรือถือมือถือ → นศ. สแกน)
- 🅱 Manual roster (staff tick name หลังกิจกรรม)
- 🅲 **Both** — QR primary, manual fallback

### Q4 — Capacity range
- 🅰 1-100 (ขยายจาก 1-20)
- 🅱 1-200 (ปลอดภัย)
- 🅲 unlimited?

### Q5 — Employer สร้างได้ไหม
- 🅰 ใช่ — ผู้จ้างก็จัด event ได้ (รับช่วยจัดงาน 30 คน)
- 🅱 **เฉพาะ staff + teacher** — กิจกรรมเป็นทางการ
- 🅲 Configurable (admin toggle)

### Q6 — NO_SHOW handling
- 🅰 ไม่ได้เงินเลย
- 🅱 ได้ค่าจ้างครึ่งหนึ่ง
- 🅲 staff ตัดสินใจ case-by-case (free comment)

### Q7 — MVP scope
- 🅰 **Minimum**: schema + form + per-person escrow (skip attendance tracking — staff manual ตัด)
- 🅱 + QR check-in + attendance UI
- 🅲 + full registration (waitlist, invite codes, reminders)

---

## 8. ตัวอย่าง use case จริง

### Use case 1: กิจกรรมจิตอาสา
- ใต้ร่มฯ สร้าง: "ทำความสะอาดสวนสาธารณะ" · 30 คน · 50 TRPB/คน · 25 พ.ค. 2569
- เปิดรับสมัคร 1 สัปดาห์ก่อนงาน
- 25 คนสมัคร · staff approve ทั้งหมด
- วันงาน 22 คนมา · 3 คน NO_SHOW
- หลังงาน — staff confirm 22 คน
- Release: 22 × 50 = 1,100 TRPB → แต่ละคน 50 (net)
- รวม cost: 22 × 56 ≈ 1,232 TRPB

### Use case 2: Workshop ของอาจารย์
- อ.A สร้าง: "ปฏิบัติการ Arduino" · 20 คน · 100 TRPB/คน · 1 มิ.ย. 2569
- รับเฉพาะ นศ. ปวส.2 ขึ้นไป (filter ระดับ tier)
- 20 คนสมัคร · auto-approve (FCFS)
- ทุกคนมา check-in ผ่าน QR
- จบ workshop — release: 20 × 100 = 2,000 TRPB

### Use case 3: ผู้จ้างจัด event (ถ้าอนุญาต)
- ผู้จ้าง XYZ จัด: "Grand Opening — รับ นศ. ช่วย serve guest" · 15 คน · 200 TRPB
- ผ่าน staff review ก่อน
- 15 คนสมัคร · 1 NO_SHOW
- Release: 14 × 200 = 2,800 → คนละ 200 net

---

## 9. Sprint plan (ถ้าตกลง)

### MVP (2-3 วัน)
- [ ] Migration: engagement_mode + pay_per_person + event_date + extend workers cap
- [ ] new-job-form: เพิ่ม section + show preview
- [ ] approve API: handle FCFS + batch approve
- [ ] release-escrow API: branch on engagement_mode → per-person logic
- [ ] Job list/detail UI: show "🎉 กิจกรรม · 30 คน × 50 TRPB"
- [ ] Staff attendance page (manual tick) — minimum viable

### v2 (2-3 วัน)
- [ ] QR check-in flow
- [ ] Attendance dashboard real-time
- [ ] Bulk-approve UI for staff
- [ ] Notification + reminders 24h before event

### v3
- [ ] Waitlist + capacity overflow
- [ ] Invite-only mode + invite codes
- [ ] Auto-generate certificate / attendance proof (NFT)

---

## สรุปสั้น

> เพิ่ม "**ACTIVITY**" mode ใน skc_jobs.engagement_mode (ปัจจุบันเป็น SOLO/TEAM โดย default)
> + ฟิลด์ pay_per_person + event_date + attendance fields ใน skc_job_workers
> + UI form + escrow logic แยก code path

ผ่าน ✅ — เริ่ม MVP ได้เลย
มี comments → ปรับ design ก่อน

ตอบ Q1-Q7 ครับ ผมจะ implement ตาม
