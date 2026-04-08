# Proposal: Learning Path & Career Ladder

> สถานะ: **DRAFT** | 2026-04-08
> Depends on: [skill-taxonomy.md](skill-taxonomy.md), [training-program.md](training-program.md)

## 1. ปัญหา

นศ. มือใหม่เข้าระบบแล้ว **ไม่รู้ว่าต้องทำอะไรต่อ** เพื่อพัฒนาทักษะ
ระบบมี credential 5 levels แต่ไม่มี "เส้นทาง" ที่ชัดเจน

## 2. ข้อเสนอ

### 2.1 Career Ladder Templates
สร้าง **template เส้นทางอาชีพ** เช่น:
- "ช่างไฟฟ้าทั่วไป" — 8 ขั้น
- "ช่างแอร์มืออาชีพ" — 6 ขั้น
- "ช่างยนต์ EV" — 10 ขั้น

แต่ละขั้นกำหนด:
- skills ที่ต้องมี (อ้าง [skill-taxonomy](skill-taxonomy.md))
- proficiency ขั้นต่ำ
- เงื่อนไข (เช่น ต้องผ่าน course X, ทำงานจริง Y งาน, ไม่มี safety incident)
- credential level ที่จะได้

### 2.2 Personal Learning Path
นศ. แต่ละคน:
- เลือก template ที่สนใจ
- ระบบคำนวณว่า "อยู่ขั้นที่ N จาก M"
- แสดง **next actions** เช่น "ต้องอบรม EL-002 + ทำงานติดตั้งสายไฟ 2 งาน"
- แสดง progress bar + estimate

### 2.3 Recommendation Engine (พื้นฐาน)
- แนะนำ course / job ที่ตรงกับ next step
- "นศ. ที่เก่งเรื่องนี้ มักไปเรียนต่อด้วย..."
- ใช้ rule-based ก่อน (ไม่ต้อง ML)

## 3. Schema (ร่าง)

```prisma
model CareerLadder {
  id          String   @id @default(uuid())
  code        String   @unique          // "EL-CAREER"
  name        String                    // "ช่างไฟฟ้าทั่วไป"
  description String?
  is_active   Boolean  @default(true)
  created_by  String

  steps StudentLadderStep[]
  enrollments StudentLadderEnrollment[]
  @@map("career_ladders")
}

model StudentLadderStep {
  id           String   @id @default(uuid())
  ladder_id    String
  order        Int
  title        String
  description  String?
  required_skills Json   // [{skill_id, min_proficiency}]
  required_courses String[]   // course ids
  required_job_count Int @default(0)
  required_job_category JobCategory?
  grants_credential_level CredentialLevel?

  ladder CareerLadder @relation(fields: [ladder_id], references: [id])
  @@unique([ladder_id, order])
  @@map("career_ladder_steps")
}

model StudentLadderEnrollment {
  id          String   @id @default(uuid())
  student_id  String
  ladder_id   String
  current_step Int     @default(1)
  started_at  DateTime @default(now())
  completed_at DateTime?

  ladder CareerLadder @relation(fields: [ladder_id], references: [id])
  student User @relation(fields: [student_id], references: [id])
  @@unique([student_id, ladder_id])
  @@map("student_ladder_enrollments")
}
```

## 4. UX

หน้า `/student/learning-path`:
```
🎯 ช่างไฟฟ้าทั่วไป (3/8)
████████░░░░░░░░░░░░ 37%

✅ ขั้น 1: พื้นฐานความปลอดภัย      [ทำเสร็จ]
✅ ขั้น 2: เดินสายไฟภายใน          [ทำเสร็จ]
✅ ขั้น 3: ติดตั้งเต้ารับ-สวิตช์    [ทำเสร็จ]
🔵 ขั้น 4: ระบบ 3 เฟส              [ทำอยู่]
   ├ อบรม EL-002 (ยังไม่ผ่าน)
   ├ ทำงาน 3 เฟส 2 งาน (ผ่าน 0/2)
   └ คะแนน safety ≥ 4.5 (ปัจจุบัน 4.2)
⚪ ขั้น 5: ตรวจรับงาน...
```

## 5. ความเสี่ยง

| เสี่ยง | บรรเทา |
|---|---|
| Template stale ไม่ตามอุตสาหกรรม | review รายปี + version ต่อ template |
| นศ. ติด step ใดเป็นเวลานาน | mentor นี้ขึ้น dashboard อาจารย์ |
| Gaming เพื่อขึ้น step เร็วๆ | ผูกกับการประเมินจริง + safety log |

## 6. Dependencies
- **ต้องการ:** skill-taxonomy, training-program (สำหรับ required_courses)
- **เสริม:** talent-directory (แสดง path บน profile)
