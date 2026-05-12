# Batch Activity Approval — Design Proposal

> เสนอระบบ "รวบงาน → ออกเอกสารขออนุมัติเดียว" สำหรับคณะทำงานใต้ร่มฯ
> ผู้ตรวจสอบ: ทีม SkillChain — หารือก่อน implementation

---

## 1. ปัญหาที่ต้องแก้

**ปัจจุบัน:** ทุกงานต้องผ่าน `activity_approval` แยกฉบับต่องาน

```
งาน 1 → เอกสารขออนุมัติ 1 ฉบับ
งาน 2 → เอกสารขออนุมัติ 1 ฉบับ
งาน 3 → เอกสารขออนุมัติ 1 ฉบับ
...
```

**ผลกระทบ:**
- ผู้มีอำนาจอนุมัติ (อธิการบดี/รองฯ) ต้องเซ็นทีละงาน → ภาระงานสูง
- เอกสารฉบับเล็ก ไม่ครอบคลุมภาพรวม → ยากในการวางแผนงบ
- กว่าจะอนุมัติเสร็จ งานอาจล่าช้า

**ต้องการ:**
- รวบรวมงานในช่วง 2-3 วัน → ออก **1 เอกสารขออนุมัติรอบ**
- มี table สรุปครบ + ยอดรวม + รายชื่อผู้เกี่ยวข้อง
- Generate เป็น md / docx → ให้ staff copy ไปใส่ในเอกสารราชการจริง (Word/PDF)
- เมื่อเอกสารจริงได้รับลายเซ็น → กดปุ่มเดียว unlock ทุกงานในรอบนี้

---

## 2. แนวคิดออกแบบ (Concept)

### "รอบอนุมัติ" (Approval Batch)

**Batch** = ชุดงานที่ใต้ร่มฯ ขอนำเสนอเพื่ออนุมัติพร้อมกัน

### Lifecycle ของ Batch

```
PENDING (กำลังรวบรวม — staff ยังเลือก/ตัดงานได้)
   ↓
COMPILED (สรุปแล้ว — md ถูก generate, รอลายเซ็น)
   ↓
APPROVED (คณบดี/อธิการเซ็นแล้ว — งานทุกชิ้น unlock เข้า ASSIGNED)
   ↓
CLOSED (ปิดรอบ — เพื่อ audit/รายงาน)

REJECTED (ถูกปฏิเสธ — staff แก้แล้วสร้างรอบใหม่)
```

### Lifecycle ของงาน (เชื่อมกับ Batch)

```
job.gov_status:
  PROJECT_DRAFT   ← ตอนสร้าง (default)
       ↓ เข้า batch
  IN_BATCH        ← รอ batch อนุมัติ (lock)
       ↓ batch.status = APPROVED
  ACTIVITY_APPROVED ← unlock — staff approve assignment ต่อได้
       ↓
  CONTRACT_PENDING → CONTRACT_SIGNED → COMPLETED → DISBURSED
```

---

## 3. Schema เพิ่มเติม

```sql
-- ตารางใหม่: batch
CREATE TABLE skc_gov_approval_batches (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- ตัวรอบ
  batch_no        TEXT UNIQUE,  -- "2026-05-A", "2026-05-B" auto-generated
  title           TEXT NOT NULL,  -- "บันทึกขออนุมัติงานช่างใต้ร่มฯ รอบ A พฤษภาคม 2569"
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  -- สถานะ
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','COMPILED','APPROVED','REJECTED','CLOSED')),

  -- เอกสาร
  document_md     TEXT,           -- generated markdown
  document_pdf_url TEXT,          -- (optional) uploaded signed PDF
  approval_note   TEXT,

  -- ผู้เกี่ยวข้อง
  created_by      TEXT NOT NULL REFERENCES skc_users(id),
  approved_by     TEXT REFERENCES skc_users(id),

  -- เวลา
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  compiled_at     TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,

  -- สรุปข้อมูล (cache)
  total_jobs      INT DEFAULT 0,
  total_students  INT DEFAULT 0,
  total_amount    NUMERIC(12,2) DEFAULT 0
);

-- เพิ่ม FK ใน skc_jobs
ALTER TABLE skc_jobs ADD COLUMN gov_batch_id TEXT
  REFERENCES skc_gov_approval_batches(id);
CREATE INDEX idx_jobs_gov_batch ON skc_jobs(gov_batch_id);
```

---

## 4. UI Flow

### หน้าใหม่: `/project-staff/gov-batches`

```
┌─────────────────────────────────────────────┐
│ ⛨ เอกสารขออนุมัติ                            │
│                                              │
│ ┌──────────────────────────────────────┐   │
│ │ + สร้างรอบใหม่                          │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ ⏳ รอบที่กำลังจัดทำ                            │
│ ┌──────────────────────────────────────┐   │
│ │ 2026-05-A · 10/5 — 12/5             │   │
│ │ COMPILED · 5 งาน · 8 นศ. · 4,500 TRPB │  │
│ │ [ดูเอกสาร] [✓ อนุมัติแล้ว] [✗ แก้ไข] │   │
│ └──────────────────────────────────────┘   │
│                                              │
│ ✅ รอบที่อนุมัติแล้ว                          │
│ ┌──────────────────────────────────────┐   │
│ │ 2026-05-A · approved 11/5 by อธิการฯ │   │
│ │ 5 งาน · 4,500 TRPB                   │   │
│ │ [ดูเอกสาร] [ดูงานในรอบ]              │   │
│ └──────────────────────────────────────┘   │
│ ...                                          │
└─────────────────────────────────────────────┘
```

### Create batch flow

```
1. กด "สร้างรอบใหม่"
   ↓
2. Modal: เลือกช่วงวันที่
   ├ ช่วงเวลา: [10/5/2569] ถึง [12/5/2569]
   └ default 3 วันย้อนหลังจาก today
   ↓
3. แสดง preview รายการงานที่จะเข้ารอบ
   ├ ✓ ติดตั้งสายไฟ ตึก B — 600 TRPB
   ├ ✓ ล้างแอร์ห้องคอม — 1,200 TRPB
   ├ ✓ งานทีมเดินสายไฟ — 3,000 TRPB (3 นศ.)
   ├ ✗ ทดสอบงาน — 500 TRPB (uncheck to exclude)
   └ ✓ ติดพัดลม — 800 TRPB
   ↓
4. กด "Generate Document"
   ↓
5. แสดง md preview ในกล่อง code
   + ปุ่ม "📋 Copy", "💾 Download .md", "📄 Download .docx"
   ↓
6. Staff นำไปใส่ในเอกสารราชการจริง → ส่งให้อธิการเซ็น
   ↓
7. กลับมา click "✓ อนุมัติแล้ว"
   + (optional) upload PDF ที่เซ็นแล้ว
   ↓
8. ระบบ:
   - update batch.status = APPROVED
   - bulk update jobs in batch: gov_status = ACTIVITY_APPROVED
   - notify all relevant employers + students
   - jobs ที่อยู่ใน batch สามารถ ASSIGN/รับงาน ได้
```

---

## 5. ตัวอย่าง MD Template (จริง)

ตัวอย่างที่ generate ออกมา — ใช้ตัวเลขจริงจาก test data:

````markdown
# บันทึกข้อความ

**ส่วนราชการ** มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา · โครงการใต้ร่มพระบารมี
**ที่** มทร.ลน. ใต้ร่มฯ / 2569 / รอบ A
**วันที่** 12 พฤษภาคม 2569

**เรื่อง** ขออนุมัติดำเนินกิจกรรมจ้างงานนักศึกษาช่าง ภายใต้โครงการใต้ร่มพระบารมี
รอบที่ A ประจำเดือนพฤษภาคม 2569

**เรียน** อธิการบดี (ผ่าน รองอธิการบดีฝ่ายกิจการนักศึกษา)

---

## 1. หลักการและเหตุผล

ตามที่มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา ได้จัดทำโครงการ "ใต้ร่มพระบารมี"
เพื่อส่งเสริมให้นักศึกษาช่างได้ฝึกประสบการณ์ทำงานจริงพร้อมกับรับค่าตอบแทน
ผ่านระบบ SkillChain ในการบริหารจัดการ จ่ายเงิน และเก็บผลงาน

ในช่วงระหว่างวันที่ **10 พฤษภาคม 2569 ถึง 12 พฤษภาคม 2569**
มีผู้ว่าจ้างประสงค์จะจ้างงานนักศึกษาช่าง รวมจำนวน **5 งาน**
ใช้กำลังนักศึกษา **8 คน** รวมงบประมาณค่าจ้าง **5,600 TRPB
(เทียบเท่า 5,600 บาท)**

จึงเรียนเสนอเพื่อขออนุมัติดำเนินกิจกรรมตามรายละเอียดในข้อ 2

## 2. รายการงานที่ขออนุมัติ

| ลำดับ | ชื่องาน | ประเภท | ผู้ว่าจ้าง | จำนวน นศ. | ค่าจ้าง (TRPB) | กำหนดส่ง |
|:---:|---|---|---|:---:|---:|:---:|
| 1 | ติดตั้งสายไฟใหม่ในห้อง 2 ห้อง | ไฟฟ้า | เสี่ยเอ | 1 | 600 | 10/5/2569 |
| 2 | ล้างแอร์ห้องเรียนคอม 6 เครื่อง | แอร์/เครื่องเย็น | เสี่ยเอ | 1 | 1,200 | 12/5/2569 |
| 3 | เปลี่ยนยางมอเตอร์ไซค์อาจารย์ 4 คัน | ยานยนต์ | เสี่ยเอ | 1 | 800 | 17/5/2569 |
| 4 | ทดสอบงานทีม - ติดตั้งระบบไฟ 3 ห้อง | ไฟฟ้า | เสี่ยเอ | 3 | 3,000 | 19/5/2569 |
| 5 | ทดสอบ E2E - ติดตั้งพัดลมเพดาน | ทั่วไป | เสี่ยเอ | 2 | 0 (จิตอาสา) | 17/5/2569 |
| | **รวม** | | | **8** | **5,600** | |

## 3. รายละเอียดเพิ่มเติม

- **คณะที่เกี่ยวข้อง**: วิศวกรรมศาสตร์, บริหารธุรกิจฯ
- **วิทยาเขต**: เชียงใหม่ (ห้วยแก้ว)
- **ระยะเวลาดำเนินกิจกรรม**: ระหว่าง 10-19 พฤษภาคม 2569
- **ระบบบันทึก**: ข้อมูลทั้งหมดเก็บบน SkillChain Blockchain (TRON Nile testnet)
  ตรวจสอบได้ที่ skillchain-rmutl.vercel.app

## 4. อัตราค่าตอบแทน

ค่าตอบแทนคำนวณตามอัตราของระบบ SkillChain
- 90% เข้าโดยตรงนักศึกษา (แบ่งเท่ากันถ้างานเป็นทีม)
- 5% เข้ากองทุนกลาง (สำหรับสนับสนุนกิจกรรมเพิ่มเติม)
- 5% เข้าค่าดำเนินการคณะทำงาน

## 5. งบประมาณ

แหล่งเงิน: เงินรายได้โครงการใต้ร่มพระบารมี
จำนวนเงิน: 5,600 TRPB (เทียบเท่า 5,600 บาท)
อ้างอิงงบประมาณปี: 2569

---

## 6. ลายมือชื่อ

|  |  |
|---|---|
| ผู้เสนอ | _________________________________ |
|  | (นางสาว/นาย ......................) |
|  | หัวหน้าคณะทำงานใต้ร่มพระบารมี |
|  | วันที่ ........... / ........... / 2569 |
|  |  |
| ผู้พิจารณา | _________________________________ |
|  | (รองอธิการบดี ฝ่ายกิจการนักศึกษา) |
|  | วันที่ ........... / ........... / 2569 |
|  |  |
| ผู้อนุมัติ | _________________________________ |
|  | (อธิการบดี) |
|  | วันที่ ........... / ........... / 2569 |

---

*เอกสารฉบับนี้สร้างจากระบบ SkillChain RMUTL — Batch ID: `2026-05-A`*
*Generated: 12 พฤษภาคม 2569 16:30 น.*
````

---

## 6. Algorithm — Generation Logic

```ts
async function createBatch(startDate: Date, endDate: Date, staffId: string) {
  // 1. หา job ที่ยังไม่ได้เข้า batch ในช่วงเวลานี้
  const { data: jobs } = await supabase
    .from("skc_jobs")
    .select(`
      id, title, type, job_category, pay_amount, deadline, required_workers,
      campus, gov_status,
      employer:skc_users!skc_jobs_employer_id_fkey(name, organization)
    `)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .or("gov_status.is.null,gov_status.in.(PROJECT_DRAFT,IN_BATCH)")
    .is("gov_batch_id", null)
    .order("created_at");

  if (jobs.length === 0) throw new Error("ไม่มีงานในช่วงนี้");

  // 2. สรุปสถิติ
  const totalAmount = jobs.reduce((sum, j) => sum + (j.pay_amount ?? 0), 0);
  const totalStudents = jobs.reduce((sum, j) => sum + (j.required_workers ?? 1), 0);

  // 3. สร้าง batch_no ตามรูปแบบ YYYY-MM-X (X = A, B, C, ...)
  const yearMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
  const { count: existingCount } = await supabase
    .from("skc_gov_approval_batches")
    .select("*", { count: "exact", head: true })
    .like("batch_no", `${yearMonth}-%`);
  const letter = String.fromCharCode(65 + (existingCount ?? 0));  // A, B, C, ...
  const batchNo = `${yearMonth}-${letter}`;

  // 4. Render md template
  const md = renderBatchMd({ batchNo, period: { startDate, endDate }, jobs, totalAmount, totalStudents });

  // 5. Insert batch
  const { data: batch } = await supabase
    .from("skc_gov_approval_batches")
    .insert({
      batch_no: batchNo,
      title: `บันทึกขออนุมัติงานช่างใต้ร่มฯ รอบ ${letter} ${monthName(endDate)} ${endDate.getFullYear() + 543}`,
      period_start: startDate.toISOString().slice(0, 10),
      period_end: endDate.toISOString().slice(0, 10),
      status: "COMPILED",
      document_md: md,
      created_by: staffId,
      compiled_at: new Date().toISOString(),
      total_jobs: jobs.length,
      total_students: totalStudents,
      total_amount: totalAmount,
    })
    .select()
    .single();

  // 6. Update jobs: link to batch + lock gov_status
  await supabase
    .from("skc_jobs")
    .update({
      gov_batch_id: batch.id,
      gov_status: "IN_BATCH",
    })
    .in("id", jobs.map((j) => j.id));

  return batch;
}
```

```ts
async function approveBatch(batchId: string, approverId: string, note: string | null) {
  const { data: batch } = await supabase
    .from("skc_gov_approval_batches")
    .update({
      status: "APPROVED",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      approval_note: note,
    })
    .eq("id", batchId)
    .select()
    .single();

  // Unlock all jobs
  await supabase
    .from("skc_jobs")
    .update({ gov_status: "ACTIVITY_APPROVED" })
    .eq("gov_batch_id", batchId);

  // Log + notify
  ...
}
```

---

## 7. คำถามให้หารือก่อนเริ่ม

1. **ช่วงเวลา (Period)**:
   - 🅰 Default 3 วันย้อนหลัง — staff ปรับได้
   - 🅱 Fixed 7 วัน — รายสัปดาห์
   - 🅲 รายเดือน

2. **เกณฑ์รวมงาน**:
   - 🅰 ทุก `PENDING_REVIEW` ในช่วง
   - 🅱 เฉพาะที่ staff approve กิจกรรมแล้ว (ลด context switch)
   - 🅲 staff เลือก checkbox ทีละชิ้นเอง

3. **เอกสาร format**:
   - 🅰 MD เท่านั้น (copy-paste ไปใส่ Word เอง) — เร็วและง่าย
   - 🅱 MD + DOCX export (มี `docx` library อยู่แล้ว)
   - 🅲 MD + PDF (ต้อง render engine)

4. **เลข batch number**:
   - 🅰 `2026-05-A`, `2026-05-B` (รายเดือน → ตัวอักษร)
   - 🅱 `ลข-001/2569`, `ลข-002/2569` (running number ตามแบบราชการ)
   - 🅲 Date-based: `20260512-001`

5. **Signed PDF upload**:
   - มี? ไม่มี? (ถ้ามี อาจเก็บใน Supabase Storage bucket `official-documents`)

6. **Notification**:
   - แจ้ง employer + นศ. + staff คนอื่นเมื่อ batch approved?
   - แจ้งผ่าน Telegram bot ด้วยไหม?

7. **Override / reject**:
   - ถ้า batch ถูกปฏิเสธ → จะเอางานออกจาก batch ได้ไหม? หรือต้องสร้างรอบใหม่?

8. **Existing system overlap**:
   - ตอนนี้มี `skc_gov_workflow_log`, `/api/gov/activity-approvals` อยู่แล้ว
   - ฟีเจอร์ใหม่นี้ทับ/เสริม/แทน? ผมว่า **เสริม** (per-job เก็บไว้ + เพิ่ม batch layer ครอบ)

---

## 8. Sprint plan (ถ้าตกลง)

### MVP — 1-2 วัน
- [ ] Migration: `skc_gov_approval_batches` + `skc_jobs.gov_batch_id`
- [ ] `lib/gov-batch.ts` — `createBatch`, `approveBatch`, `renderBatchMd`
- [ ] `/api/gov/batches` (GET list, POST create)
- [ ] `/api/gov/batches/[id]` (GET detail, PATCH approve)
- [ ] `/project-staff/gov-batches/page.tsx` — list + create modal
- [ ] `/project-staff/gov-batches/[id]/page.tsx` — md preview + approve button

### v2 — 1 วัน
- [ ] DOCX export (ใช้ `docx` library ที่มีอยู่)
- [ ] Upload signed PDF
- [ ] Notifications (Telegram + in-app)

### v3 — เพิ่มภายหลัง
- [ ] Auto-create batch ทุก 3 วันด้วย cron
- [ ] Sign with TRON wallet (digital signature on-chain)
- [ ] Multiple approvers (sequential signing)

---

## สรุปสั้นๆ ที่ต้องตอบ

> 1. รับ design ของ batch + lifecycle ตามนี้ไหม?
> 2. ตอบ 8 คำถามด้านบน
> 3. เริ่ม MVP เลย หรือปรับ design ก่อน?

---

*Reference: ดู `docs/GOVERNMENT_WORKFLOW.md` สำหรับ workflow ราชการแบบ per-job ที่มีอยู่*
