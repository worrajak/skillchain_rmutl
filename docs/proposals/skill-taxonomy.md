# Proposal: Skill Taxonomy & Competency Framework

> สถานะ: **DRAFT** | ผู้เสนอ: ทีม SkillChain RMUTL | 2026-04-08
> ระดับความสำคัญ: 🔴 **รากฐานของทุก proposal ที่เหลือ**

## 1. ปัญหา

ปัจจุบันระบบจำแนกทักษะด้วย `JobCategory` แค่ 4 ค่า (electrical / hvac / automotive / general)
หยาบเกินกว่าจะตอบคำถามว่า:
- "ใครเดินสายไฟ 3 เฟสได้บ้าง"
- "งานนี้ต้องการ competency code อะไรของ TPQI"
- "นศ. คนนี้ขาด skill อะไรเพื่อขึ้น Level 3"

## 2. ข้อเสนอ

สร้าง **Skill Taxonomy** เป็นต้นไม้ทักษะที่:
- แต่ละ node มี `code` มาตรฐาน
- map กับมาตรฐานนอก (TPQI, DSD, ISCO-08)
- ทุก `Job`, `TrainingCourse`, `Evaluation`, `Credential` อ้างอิงได้

```
ROOT
├─ electrical
│   ├─ EL-001  เดินสายไฟภายในอาคาร (DSD ระดับ 1)
│   ├─ EL-002  ติดตั้งระบบ 3 เฟส
│   └─ EL-003  ระบบ solar rooftop
├─ hvac
│   ├─ HV-001  ติดตั้งแอร์บ้าน
│   └─ HV-002  ระบบ chiller
└─ automotive
    └─ ...
```

## 3. Schema (ร่าง)

```prisma
enum SkillStandard {
  INTERNAL
  TPQI
  DSD
  ISCO08
}

model Skill {
  id          String   @id @default(uuid())
  code        String   @unique           // "EL-002"
  name_th     String
  name_en     String?
  description String?
  category    JobCategory                  // คงไว้เพื่อ backward compat
  parent_id   String?
  level_hint  Int?                         // hint ระดับความยาก 1-5

  parent      Skill?   @relation("SkillTree", fields: [parent_id], references: [id])
  children    Skill[]  @relation("SkillTree")
  mappings    SkillMapping[]
  job_skills  JobSkill[]
  module_skills TrainingModuleSkill[]

  @@map("skills")
}

model SkillMapping {
  id            String        @id @default(uuid())
  skill_id      String
  standard      SkillStandard
  external_code String                       // เช่น "TPQI-EE-101"
  reference_url String?

  skill Skill @relation(fields: [skill_id], references: [id])
  @@unique([skill_id, standard, external_code])
  @@map("skill_mappings")
}

// pivot — ผูก Job ↔ Skill (ทดแทน job_category เดี่ยว)
model JobSkill {
  job_id     String
  skill_id   String
  required_level Int @default(1)            // ระดับขั้นต่ำที่ต้องมี

  job   Job   @relation(fields: [job_id], references: [id])
  skill Skill @relation(fields: [skill_id], references: [id])
  @@id([job_id, skill_id])
  @@map("job_skills")
}

model TrainingModuleSkill {
  module_id String
  skill_id  String
  // ผ่าน module นี้ → เพิ่ม proficiency ของ skill นี้

  @@id([module_id, skill_id])
  @@map("training_module_skills")
}

// คะแนนสะสมของ นศ. ต่อทักษะ (denormalized cache)
model StudentSkillProficiency {
  student_id    String
  skill_id      String
  proficiency   Int      @default(0)         // 0-100
  evidence_count Int     @default(0)
  last_updated  DateTime @updatedAt

  @@id([student_id, skill_id])
  @@map("student_skill_proficiency")
}
```

## 4. การใช้งาน

| ที่ใช้ | ใช้อย่างไร |
|---|---|
| สร้างงาน | employer เลือก skill + required level → ระบบ filter เฉพาะ นศ. ที่ proficient ≥ |
| สร้างหลักสูตร | instructor map module → skills ที่จะได้หลังผ่าน |
| ประเมินผล | evaluator เลือก skill ที่ใช้จริง + ให้คะแนน → update `StudentSkillProficiency` |
| Search talent | filter ตาม skill code + level |
| Career ladder | คำนวณ "ขาด skill อะไรเพื่อขึ้น level ถัดไป" |

## 5. การนำเข้าข้อมูลตั้งต้น (Seed)

- เริ่มจากทักษะหลักของ มทร.ล้านนา + ใต้ร่มฯ ราว 30-50 skills
- import จาก csv ที่ทีมโครงการเตรียม
- mapping TPQI/DSD ค่อยๆ เติมตามที่ partner อนุมัติ

## 6. Migration Strategy

- เพิ่มตารางใหม่ — **ไม่แตะ** `JobCategory` เดิม
- งานใหม่บังคับให้ระบุ `JobSkill` อย่างน้อย 1
- งานเก่า: script auto-tag จาก category → skill default
- เปิด feature flag `USE_SKILL_TAXONOMY=true` เพื่อค่อยๆ ใช้

## 7. ความเสี่ยง

| เสี่ยง | บรรเทา |
|---|---|
| Taxonomy บานเกินไป | committee อนุมัติก่อน add skill ใหม่ |
| Mapping มาตรฐานผิด | review โดยผู้เชี่ยวชาญแต่ละ domain |
| UX ซับซ้อน | autocomplete + suggested skills จาก template |

## 8. Dependencies
- **เป็น dependency ของ:** Talent Directory, Learning Path, Training Program (ขั้นสมรรถนะ)
- ไม่มี dependency ขาเข้า — เริ่มได้เลย
