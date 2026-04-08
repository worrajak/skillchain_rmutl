# Proposal: Training Program & Instructor Payment

> สถานะ: **DRAFT — เพื่อการหารือ** (ยังไม่ implement)
> ผู้เสนอ: ทีม SkillChain RMUTL
> วันที่: 2026-04-08

## 1. ที่มา

ปัจจุบันระบบ SkillChain มี credential 5 ระดับ (Registered → Master Technician)
แต่ยังไม่มี **เส้นทางการฝึกอบรมที่เป็นทางการ** ก่อนเข้าทำงานจริง

ข้อเสนอนี้เพิ่ม **หลักสูตรระยะสั้น (Short Course)** เป็นทางเข้าหลักของนักศึกษา
เพื่อให้:
1. นักศึกษาได้พื้นฐานก่อนรับงานจริง (ลด safety incident)
2. อาจารย์ / ทีมใต้ร่มฯ มีช่องทางสร้างรายได้เป็น TRPB จากการสอน
3. ระบบมี "หลักฐานการอบรม" ที่ใช้ประเมินเลื่อน Level 1 → Level 2 ได้
4. ในอนาคตเปิดรับคนนอก มทร.ล้านนา และรับเงินจากการบริจาค/หน่วยงานพันธมิตร

## 2. แนวคิดหลัก

หลักสูตรเป็น **"งานอีกประเภทหนึ่ง"** ใน SkillChain — reuse infrastructure เดิม
(jobs, escrow, evaluation, NFT credential) แทนการสร้างระบบใหม่ทั้งหมด

```
TrainingCourse ─┬─▶ Module 1 ─┐
                ├─▶ Module 2 ─┤─▶ assess ─▶ pass/fail ─▶ TRPB payout (instructor)
                └─▶ Module N ─┘                       └─▶ credential bump (trainee)
```

## 3. โมเดลการจ่ายค่าวิทยากร — เปรียบเทียบ

> **บริบทสำคัญ:** ตอนนี้โครงการอยู่บน **TRON Nile Testnet** + 1 TRPB peg 1 THB
> ระยะเริ่มแรก **วิทยากรงดรับค่าตอบแทน** (volunteer) และระบบจะ
> **ระดมเงินบริจาค** เข้ากองทุนกลางเพื่อใช้จ่ายเมื่อขึ้น mainnet ในอนาคต
> โมเดลด้านล่างคือ **โครงสร้างที่จะใช้ใน Phase 2+** เมื่อมี backing พอ

มี 3 รูปแบบให้พิจารณา:

### Option A — Hourly Rate (รายชั่วโมง)
- จ่ายตามชั่วโมงที่สอนจริง × อัตรา TRPB/ชม. (1 TRPB = 1 THB)
- ตัวอย่าง: 400 TRPB/ชม. × 6 ชม. = 2,400 TRPB (≈ 2,400 บาท)
- **ข้อดี:** ตรงไปตรงมา, คุ้มเวลา prep
- **ข้อเสีย:** ไม่ผูกกับผลลัพธ์ — สอนแล้วไม่มีคนผ่านก็ได้เงินเท่าเดิม
- **เหมาะกับ:** lecture, ทฤษฎี, demo

### Option B — Per Module Pass (ต่อโมดูลที่ผ่าน)
- จ่ายตามจำนวนนักศึกษา × จำนวนโมดูลที่ผ่านการประเมิน
- ตัวอย่าง: 100 TRPB × 10 นศ. × 3 โมดูล = 3,000 TRPB
- **ข้อดี:** ผูกกับผลลัพธ์, สร้างแรงจูงใจให้สอนให้ผ่าน
- **ข้อเสีย:** เสี่ยง grade inflation, วัด "ผ่าน" ต้อง objective
- **เหมาะกับ:** workshop ที่มีสมรรถนะวัดได้ชัด

### Option C — Hybrid (แนะนำ ✅ สำหรับ Phase 2+)
- **Base** = hourly rate (เช่น 60% ของอัตรา)
- **Bonus** = per-pass module (เช่น 40% เป็น performance)
- ตัวอย่างหลักสูตร "ช่างไฟฟ้าพื้นฐาน" 12 ชม. / 10 คน / 4 โมดูล:
  - Base: 400 TRPB × 12 ชม. = 4,800 TRPB
  - Bonus: 100 TRPB × 10 นศ. × 4 โมดูลผ่าน = 4,000 TRPB
  - **รวม: 8,800 TRPB ≈ 8,800 บาท** ต่อหลักสูตร
- **ข้อดี:** balance ระหว่างเวลาที่ลงทุน + คุณภาพผลลัพธ์
- **ข้อเสีย:** คำนวณซับซ้อนกว่า, ต้อง config ต่อหลักสูตร

> **ข้อเสนอ:** เริ่มจาก **Option C (Hybrid)** เพราะสะท้อนทั้ง effort และ outcome

### อัตราแนะนำ (Phase 2+)

| รายการ | อัตรา (TRPB = THB) | หมายเหตุ |
|---|---|---|
| Base hourly — อาจารย์/ผู้เชี่ยวชาญ | **300–600/ชม.** | เทียบเรทค่าวิทยากรราชการ |
| Base hourly — ผู้ช่วยวิทยากร/ทีมใต้ร่มฯ | **150–300/ชม.** | ผู้ช่วยสอน/ฝึกปฏิบัติ |
| Bonus per pass (ต่อ นศ. ต่อโมดูล) | **50–150** | ขึ้นกับความยากของสมรรถนะ |
| เพดาน budget ต่อ course | กำหนดเฉพาะหลักสูตร | lock ใน Escrow ตอน publish |

> อัตราจริงให้คณะกรรมการโครงการกำหนดอีกครั้งก่อนเข้า Phase 2

## 3.1 Phase 1 — Volunteer Mode (สถานะปัจจุบัน) 🟡

ระยะเริ่มแรกบน Testnet:
- 🚫 **วิทยากรงดรับค่าตอบแทน** — ทุกคนเป็น volunteer
- 💝 **ระดมเงินบริจาค** เข้ากองทุนกลาง (`DonationFund`) เพื่อสะสมเป็น backing
- 🪙 ระบบยังคง **บันทึก "ยอดที่พึงได้"** (accrued balance) ของวิทยากรไว้ใน DB
  เพื่อความโปร่งใสและใช้คำนวณ ROI ของโครงการ
- 📊 แสดง dashboard "ค่าวิทยากรค้างจ่าย (pledged)" vs "เงินบริจาคสะสม"
- ⏭ เมื่อบริจาคถึงเกณฑ์ + ขึ้น mainnet → switch เป็น Hybrid Payment จริง

### Schema เพิ่มเติมสำหรับ Phase 1
ให้ `TrainingCourse` มีฟิลด์
```prisma
payment_mode      PaymentMode  @default(VOLUNTEER)  // VOLUNTEER | HYBRID
pledged_trpb      Float        @default(0)          // ยอดที่ "ควรจ่าย" สะสม
```
และ enum ใหม่
```prisma
enum PaymentMode {
  VOLUNTEER   // Phase 1 — ไม่จ่ายจริง แค่บันทึก
  HYBRID      // Phase 2 — จ่ายจริงผ่าน Escrow
}
```

### Donation Earmark
ใน `DonationFund` (มีอยู่แล้ว) ใช้ฟิลด์ `is_restricted` + `restriction_note`
เพื่อ earmark เงินเข้า "กองทุนค่าวิทยากรอบรมอาชีพ" โดยเฉพาะ
หรือเพิ่ม `purpose_code = "TRAINING_INSTRUCTOR"` เป็น convention

## 4. โครงสร้างข้อมูลที่ต้องเพิ่ม

### Schema ใหม่ (ร่าง)

```prisma
enum CourseStatus {
  DRAFT
  OPEN_ENROLLMENT
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum TrainingProvider {
  RMUTL_TEACHER       // อาจารย์ มทร.ล้านนา
  PROJECT_BARAMEE     // ทีมใต้ร่มฯ
  DSD_PARTNER         // สพร.19 เชียงใหม่
  TPQI_PARTNER        // สคช. ส่วนกลาง
  EXTERNAL            // วิทยากรภายนอก
}

model TrainingCourse {
  id                  String         @id @default(uuid())
  title               String
  description         String
  category            JobCategory
  provider            TrainingProvider
  instructor_id       String         // user id ของวิทยากรหลัก
  status              CourseStatus   @default(DRAFT)

  // เวลาและความจุ
  start_date          DateTime
  end_date            DateTime
  total_hours         Float
  max_participants    Int
  min_participants    Int            @default(1)
  is_open_to_external Boolean        @default(false)  // รับคนนอก มทร.ล้านนา?

  // การจ่ายเงิน (Hybrid model)
  hourly_rate_trpb    Float          // base ต่อ ชม.
  per_pass_rate_trpb  Float          // bonus ต่อ นศ. ที่ผ่าน 1 โมดูล
  total_budget_trpb   Float          // เพดาน budget (ใส่ใน Escrow)
  funding_source      String?        // donor/project/partner
  escrow_tx           String?

  // ระดับที่จะได้หลังผ่าน
  grants_credential_level CredentialLevel?

  created_at          DateTime       @default(now())
  updated_at          DateTime       @updatedAt

  instructor          User                 @relation(...)
  modules             TrainingModule[]
  enrollments         TrainingEnrollment[]

  @@map("training_courses")
}

model TrainingModule {
  id              String   @id @default(uuid())
  course_id       String
  order           Int
  title           String
  competency_code String?  // เทียบกับมาตรฐาน DSD/TPQI
  hours           Float
  pass_criteria   String   // อธิบายเกณฑ์ผ่าน

  course      TrainingCourse @relation(fields: [course_id], references: [id])
  assessments ModuleAssessment[]

  @@unique([course_id, order])
  @@map("training_modules")
}

model TrainingEnrollment {
  id           String   @id @default(uuid())
  course_id    String
  trainee_id   String
  is_external  Boolean  @default(false)   // คนนอก มทร.ล้านนา
  enrolled_at  DateTime @default(now())
  completed_at DateTime?

  course      TrainingCourse @relation(fields: [course_id], references: [id])
  trainee     User           @relation(...)
  assessments ModuleAssessment[]

  @@unique([course_id, trainee_id])
  @@map("training_enrollments")
}

model ModuleAssessment {
  id            String   @id @default(uuid())
  module_id     String
  enrollment_id String
  passed        Boolean
  score         Float?
  evidence_url  String?  // รูป/ไฟล์หลักฐาน
  assessor_id   String   // user id ของผู้ประเมิน
  on_chain_tx   String?  // บันทึก hash ผลประเมิน
  assessed_at   DateTime @default(now())

  module     TrainingModule     @relation(fields: [module_id], references: [id])
  enrollment TrainingEnrollment @relation(fields: [enrollment_id], references: [id])

  @@unique([module_id, enrollment_id])
  @@map("module_assessments")
}
```

### เพิ่มใน enum เดิม
- `JobType` เพิ่ม `TRAINING_COURSE` (แยกจาก `TRAINING` เดิม ที่หมายถึงงานฝึก on-the-job)

## 5. Lifecycle ของ Training Course

```
DRAFT
  ↓ (instructor publish + lock TRPB ใน Escrow)
OPEN_ENROLLMENT
  ↓ (ถึง start_date และมีคน ≥ min_participants)
IN_PROGRESS
  ↓ (ทุก module ประเมินครบ + ครบ end_date)
COMPLETED
  ↓ (settle escrow)
└─▶ instructor: รับ TRPB (hourly base + per-pass bonus)
└─▶ trainee ที่ผ่าน: ได้ credential bump + NFT
```

## 6. การเชื่อมกับ Credential System

| ผ่านหลักสูตร | ได้ credential |
|---|---|
| หลักสูตรพื้นฐานของทีมใต้ร่มฯ | Level 1 → **Level 2** (`PROJECT_BARAMEE`) |
| หลักสูตรขั้นสูงของอาจารย์ | Level 2 → **Level 3** (`RMUTL_TEACHER`) |
| หลักสูตรร่วมกับ สพร.19 | สอบมาตรฐานฝีมือแรงงาน → **Level 4** (`DSD`) |
| หลักสูตรร่วมกับ สคช. | คุณวุฒิวิชาชีพ → **Level 4** (`TPQI`) |

ใช้ฟิลด์ `TrainingCourse.grants_credential_level` ระบุว่า course นี้
หากผ่านครบทุก module จะ mint credential ระดับใดให้

## 7. การรับคนนอก มทร.ล้านนา

- เปิด `is_open_to_external = true` ที่ระดับ course
- คนนอกสมัครผ่าน path พิเศษ → สร้าง `User` role พิเศษ (เสนอเพิ่ม `external_trainee`)
- เก็บค่าธรรมเนียม / รับ donation เข้า course นั้นโดยเฉพาะ (`DonationFund.purpose` ผูกกับ course id)
- หลังผ่าน ได้ credential ที่ทำงานนอก SkillChain ก็ verify ได้ผ่าน on-chain

## 8. ความเป็นไปได้กับระบบปัจจุบัน

| ประเด็น | สถานะ | หมายเหตุ |
|---|---|---|
| Reuse JobEscrow ได้ไหม | ✅ ได้ | ถือว่า course = "งาน" แบบหนึ่ง — lock budget ตอน publish |
| Reuse credential / NFT pipeline | ✅ ได้ | ใช้ `StudentCredential` เดิม + `nft_tx_hash` |
| RBAC ผ่าน middleware เดิม | ✅ ได้ | เพิ่ม path `/training/*` |
| ต้องเพิ่ม role ใหม่ | ⚠️ อาจ | `external_trainee` สำหรับคนนอก |
| Schema ใหม่ | ⚠️ ต้องเพิ่ม | 4 model + 2 enum (ร่างอยู่ section 4) |
| Smart contract ใหม่ | ❌ ไม่จำเป็น | ใช้ JobEscrow + TRPB เดิมพอ |
| Migration กระทบของเดิม | 🟢 ต่ำ | เพิ่มอย่างเดียว ไม่ได้แก้ schema เดิม |

**สรุป: ทำได้ และผลกระทบกับ codebase เดิมต่ำ**

## 9. ประเด็นที่ต้องตัดสินใจ (เปิดหารือ)

1. **โมเดลจ่ายเงิน** — เลือก A / B / C? ผมแนะนำ C (Hybrid)
2. **อัตราเริ่มต้น** — กี่ TRPB/ชม. และกี่ TRPB/pass? ใครกำหนด (admin? committee?)
3. **เกณฑ์ "ผ่าน" module** — วัดอย่างไรให้ objective? checklist? คะแนน? video evidence?
4. **คนนอก มทร.ล้านนา** — รับฟรี หรือเก็บค่าธรรมเนียม? ใครออกใบเสร็จ?
5. **ความสัมพันธ์กับ สพร.19 / สคช.** — MOU หรือแค่ partner level? ใครเป็นคนรับรอง?
6. **กรณีปิดคอร์สกลางทาง** — refund อย่างไร? ทั้งวิทยากรและผู้เรียน?
7. **เงินจากการบริจาค** — earmark ต่อ course ได้ไหม? ใครอนุมัติใช้?
8. **MVP scope** — เริ่มจากแค่ในมหาลัย → ขยายคนนอกทีหลัง?

## 10. Roadmap ที่เสนอ

**Phase 1 — MVP / Volunteer Mode (in-house only) 🟡 ปัจจุบัน**
- เพิ่ม schema 4 model + `payment_mode = VOLUNTEER`
- หน้าสร้าง course (instructor) + เปิด enrollment
- วิทยากร **ไม่รับค่าตอบแทน** — ระบบบันทึก `pledged_trpb` ไว้
- เปิดหน้ารับบริจาคเข้ากองทุนค่าวิทยากร (`DonationFund` earmark)
- Dashboard เทียบ pledged vs donated
- ออก credential หลังผ่านทั้ง course

**Phase 2 — Hybrid Payment + Escrow**
- เปิดเมื่อขึ้น mainnet หรือมี donation backing พอ
- เปลี่ยน `payment_mode = HYBRID` ต่อ course
- ผูก JobEscrow lock budget ตอน publish
- Auto settle เมื่อ status → COMPLETED (base + bonus)
- NFT credential mint อัตโนมัติ
- จ่ายค่า "ค้างชำระ" (pledged) ของ Phase 1 ย้อนหลังถ้าเกณฑ์อนุญาต

**Phase 3 — External & Partners (mainnet)**
- เพิ่ม role `external_trainee`
- รับ donation earmark ต่อ course
- เชื่อม API กับ สพร.19 / สคช. (ถ้ามี)
- เปิด catalog หลักสูตรสาธารณะ

---

## ความเห็นของผม (สรุปสั้น)

✅ **ทำได้ และสอดคล้องกับสถาปัตยกรรมเดิม** — ไม่ต้องเขียน contract ใหม่ ไม่ต้องแก้ schema เดิม
✅ **Hybrid payment** ตอบโจทย์ทั้งครูที่ลงเวลา prep และ outcome ของผู้เรียน
⚠️ **จุดเสี่ยงหลักคือเกณฑ์ "ผ่าน" module** — ถ้า subjective เกินไป จะเกิด grade inflation
⚠️ **MVP ควรจำกัดแค่ในมหาลัยก่อน** เพื่อทดสอบกระบวนการก่อนเปิดคนนอก
💡 **ของ้อต่อยอด:** ถ้า course ผูกกับ "งานจริง" ที่กำลังเปิด (เช่น เปิดอบรมก่อน → จบแล้วต่อด้วยงานติดตั้งจริงเป็น mentorship) จะกลายเป็น **end-to-end pipeline** ที่ทรงพลังมาก
