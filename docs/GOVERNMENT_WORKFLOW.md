# Government Workflow Integration — Phase 1

ระบบติดตามเอกสารราชการ **คู่ขนาน** กับ Blockchain track
เพื่อให้การจ่ายค่าตอบแทน นศ. เป็นไปตามระเบียบราชการ มทร.ล้านนา

---

## แนวคิด: 2 Tracks คู่ขนาน

```
Track A: Blockchain (Smart Contract Escrow)
  OPEN → ASSIGNED → IN_PROGRESS → SUBMITTED → APPROVED → ESCROW_RELEASED

Track B: Government Paperwork (เพิ่มใหม่)
  DRAFT → ACTIVITY_APPROVAL_PENDING → ACTIVITY_APPROVED →
  CONTRACT_PENDING → CONTRACT_SIGNED → IN_PROGRESS →
  WORK_CERTIFIED → DISBURSEMENT_PENDING → DISBURSEMENT_APPROVED →
  PAID → COMPLETED
```

**Gate Rule**: Blockchain ไม่ปล่อยเงินจนกว่า Track B จะถึง `WORK_CERTIFIED`

---

## ไฟล์ที่เกี่ยวข้อง

### Database
- `prisma/migrations/manual_government_workflow.sql`
  - 8 ตารางใหม่ + 3 enums + RLS policies
  - เพิ่ม `gov_status`, `gov_project_id`, `gov_activity_id` ใน `jobs`

### Core Libraries
- `src/lib/gov-workflow.ts` — State machine + notifications + overdue detection
- `src/lib/gov-documents.ts` — Generator สำหรับ 3 เอกสารหลัก (.docx)

### API Routes
| Endpoint | หน้าที่ |
|---|---|
| `POST /api/gov/activity-approvals` | สร้างบันทึกขออนุมัติกิจกรรม |
| `GET /api/gov/activity-approvals` | ดึงรายการ |
| `POST /api/gov/activity-approvals/[id]/approve` | อนุมัติ/ปฏิเสธ |
| `POST /api/gov/activity-approvals/[id]/generate-doc` | สร้างไฟล์ .docx |
| `POST /api/gov/work-certifications` | สร้างใบรับรองการปฏิบัติงาน |
| `GET /api/gov/work-certifications` | ดึงรายการ |
| `POST /api/gov/disbursements` | สร้างใบเบิก |
| `POST /api/gov/disbursements/[id]/approve` | อนุมัติ 3 ขั้น (HEAD/FINANCE/FINAL) |
| `POST /api/gov/disbursements/[id]/pay` | บันทึกการจ่ายเงิน |

### UI
- `/staff/gov` — Dashboard สำหรับ staff
- `/staff/gov/jobs/[id]` — ติดตามสถานะ workflow ของ 1 งาน

---

## ตารางในฐานข้อมูล

| ตาราง | หน้าที่ |
|---|---|
| `gov_projects` | โครงการแม่ (ขออนุมัติ 1 ครั้ง/ปี) |
| `activity_approvals` | อนุมัติกิจกรรมย่อย (ทุกงาน) |
| `gov_contracts` | สัญญาจ้าง นศ. |
| `gov_timesheets` | ใบลงเวลาปฏิบัติงาน (link จาก job_checkins) |
| `work_certifications` | ใบรับรองการปฏิบัติงาน |
| `disbursements` | ใบเบิกค่าตอบแทน |
| `official_documents` | ทะเบียนเอกสารทั้งหมด (wire to file storage) |
| `gov_workflow_log` | Audit trail — เก็บทุก state transition |

---

## 3 เอกสารที่สร้างอัตโนมัติใน Phase 1

### 1. บันทึกขออนุมัติกิจกรรม
**ไฟล์:** `generateActivityApprovalDoc()` ใน `gov-documents.ts`

**เนื้อหา:**
- หัวบันทึกข้อความ (ส่วนราชการ, ที่, วันที่, เรื่อง, เรียน)
- วัตถุประสงค์
- ตารางข้อมูล: จำนวน นศ., ชม., อัตรา, งบประมาณ, ระยะเวลา
- ช่องลงนาม "ผู้เสนอ" + "ผู้อนุมัติ (คณบดี/รอง/อธิการ)"
- Checkbox "อนุมัติ / ไม่อนุมัติ"

### 2. ใบรับรองการปฏิบัติงาน
**ไฟล์:** `generateWorkCertificationDoc()`

**เนื้อหา:**
- หัวเรื่อง "ใบรับรองการปฏิบัติงาน"
- ข้อมูล นศ. + งาน (สถานที่, ช่วงเวลา, ชั่วโมงรวม)
- ผลการปฏิบัติงาน + สรุป
- ลงนาม 3 ฝ่าย: ผู้ว่าจ้าง + พี่เลี้ยง + staff

### 3. แบบขอเบิกค่าตอบแทน
**ไฟล์:** `generateDisbursementRequestDoc()`

**เนื้อหา:**
- หัวบันทึกข้อความ
- ตารางรายการขอเบิก (ทุก นศ. + ชม. + อัตรา + ยอด)
- ยอดรวม + ตัวอักษรไทย (แปลงอัตโนมัติ)
- ลงนาม 4 ขั้น:
  1. ผู้ขอเบิก
  2. หัวหน้าโครงการ
  3. ฝ่ายการเงิน
  4. อธิการ/รองอธิการ

---

## ระบบเตือน Staff (Notification Flow)

ส่งผ่าน Telegram Bot + in-app notification

| เหตุการณ์ | ผู้ได้รับ | ข้อความ |
|---|---|---|
| งานใหม่ → ต้องขออนุมัติ | `rmutl_staff`, `project_staff` | "มีงานใหม่รอจัดทำบันทึกขออนุมัติ" |
| อนุมัติแล้ว → ต้องทำสัญญา | staff | "รอจัดทำสัญญาจ้าง นศ." |
| งานเสร็จ → ต้องทำใบเบิก | staff | "รอจัดทำใบเบิกค่าตอบแทน" |
| ใบเบิกรอตรวจ | staff + การเงิน | "ใบเบิกรอการตรวจสอบ" |
| ใบเบิกอนุมัติ → ต้องจ่ายเงิน | staff | "อนุมัติแล้ว รอจ่ายเงิน" |
| ปฏิเสธ | staff | "คำขอถูกปฏิเสธ" |

**Overdue Detection** (ต้อง cron job):
- ขออนุมัติกิจกรรมค้าง > 3 วัน → เตือนซ้ำ
- สัญญาจ้างค้าง > 5 วัน → เตือนซ้ำ
- ใบเบิกค้าง > 14 วัน → เตือนซ้ำ

---

## Configuration Points (ปรับตามระเบียบ มทร.ล้านนา)

สิ่งที่ต้องปรับเมื่อได้ระเบียบ:

1. **อำนาจอนุมัติ** (`gov-workflow.ts` → `getNextAction`)
   - ตอนนี้: default เป็น "คณบดี"
   - ต้องเปลี่ยนตามวงเงิน: ≤10K → คณบดี, 10K-50K → รองอธิการ, >50K → อธิการ

2. **Overdue Thresholds** (`gov-workflow.ts` → `DEFAULT_OVERDUE`)
   - Activity: 3 วัน
   - Contract: 5 วัน
   - Work Cert: 7 วัน
   - Disbursement: 14 วัน

3. **Rate per hour** — ต้องใส่ใน `activity_approvals.rate_per_hour` ตามมาตรฐาน ม.
   - ปวช./ปวส./ป.ตรี อาจมีอัตราต่างกัน

4. **Budget Sources** (`gov_projects.budget_source`)
   - งบประจำ / งบวิจัย / งบบริการวิชาการ / ค่าจ้างภายนอก
   - แต่ละแหล่งกฎเบิกจ่ายต่างกัน

5. **Approval Chain** (`disbursements.*_approved_by`)
   - ตอนนี้: 3 ขั้น (HEAD/FINANCE/FINAL)
   - ปรับตามโครงสร้างจริงของ ม.

---

## ขั้นตอนการ Deploy

1. **รัน SQL migration:**
   ```
   Supabase SQL Editor → รัน manual_government_workflow.sql
   ```

2. **สร้าง Supabase Storage bucket:**
   ```
   bucket name: official-documents
   public: true (หรือสร้าง signed URLs)
   ```

3. **ตั้ง environment variables:** (มีอยู่แล้ว)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`

4. **ทดสอบ flow:**
   1. สร้าง `gov_projects` (โครงการแม่)
   2. สร้างงานผ่าน `/employer/jobs/new`
   3. Staff เข้าที่ `/staff/gov` → เห็นงานในรายการ
   4. สร้างบันทึกขออนุมัติ (`POST /api/gov/activity-approvals`)
   5. ดาวน์โหลด .docx (`POST .../generate-doc`)
   6. คณบดีเข้ามาอนุมัติ → status update อัตโนมัติ
   7. งานเสร็จ → สร้างใบรับรอง (`POST /api/gov/work-certifications`)
   8. รวบรวมใบเบิก (`POST /api/gov/disbursements`)
   9. อนุมัติ 3 ขั้น (`POST .../approve` stage: HEAD → FINANCE → FINAL)
   10. บันทึกการจ่าย (`POST .../pay`)

---

## Roadmap (Phase 2 & 3)

### Phase 2 (1-2 เดือน)
- [ ] เอกสารเพิ่มเติม: คำสั่งแต่งตั้งคณะทำงาน, สัญญาจ้าง, ใบสำคัญรับเงิน, รายงานผลโครงการ
- [ ] e-Signature integration (ThaID / ดิจิทัลซิกเนเจอร์)
- [ ] Bulk disbursement (รวมหลายงานใน 1 ใบเบิก)
- [ ] Overdue cron job + email reminders
- [ ] Excel export สำหรับการเงิน

### Phase 3 (3+ เดือน)
- [ ] เชื่อม ERP มทร.ล้านนา (ถ้ามี)
- [ ] Dashboard วิเคราะห์งบประมาณ (used vs approved)
- [ ] Mobile app สำหรับ approver
- [ ] Automated audit report
