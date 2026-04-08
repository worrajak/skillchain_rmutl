# Proposal: Community Endorsement & Mentor Pairing

> สถานะ: **DRAFT** | 2026-04-08

## 1. ปัญหา

ตอนนี้ rating มาจากแค่ "ผู้มีอำนาจ" (employer/teacher/staff) — ขาดมิติของ
**ภาคชุมชน/peer**

นอกจากนี้ มี `MentorReview` แล้ว แต่ **ไม่มีกลไกขอพี่เลี้ยง** จากฝั่ง trainee
mentor pairing เกิดแบบ ad-hoc

## 2. ข้อเสนอ — สองส่วน

### A) Community Endorsement
ให้คนในชุมชน (เพื่อนร่วมงาน, alumni, ลูกค้าเก่า) **endorse** ทักษะของกันได้
- ไม่ใช่ rating ดาว — เป็นแค่ "ยืนยันว่าคนนี้ทำสิ่งนี้ได้"
- ผูกกับ skill code (จาก [skill-taxonomy](skill-taxonomy.md))
- ผูกกับ wallet → 1 endorsement / pair / skill / 6 เดือน
- แสดงบน talent profile แต่ **น้ำหนักน้อยกว่า** rating ทางการ

### B) Mentor Pairing
- หน้า "ขอพี่เลี้ยง" สำหรับ trainee
- เลือก skill ที่อยากเรียน + รูปแบบ (online/onsite)
- ระบบ match กับ mentor ที่:
  - มี proficiency สูงในทักษะนั้น
  - rating ดี
  - มีโควต้าว่าง (mentor 1 คน รับได้กี่ trainee พร้อมกัน — กำหนดได้)
- mentor accept/reject ได้
- เมื่อจับคู่ → สร้าง `MentorshipPair` มีระยะเวลา + เป้าหมาย

## 3. Schema (ร่าง)

```prisma
model SkillEndorsement {
  id           String   @id @default(uuid())
  endorser_id  String                       // คนที่ให้
  endorsee_id  String                       // คนที่ได้รับ
  skill_id     String
  context      String?                      // "ทำงานด้วยกัน 6 เดือน"
  on_chain_tx  String?
  created_at   DateTime @default(now())

  endorser User  @relation("EndorsementsGiven", fields: [endorser_id], references: [id])
  endorsee User  @relation("EndorsementsReceived", fields: [endorsee_id], references: [id])
  skill    Skill @relation(fields: [skill_id], references: [id])

  @@unique([endorser_id, endorsee_id, skill_id])
  @@index([endorsee_id, skill_id])
  @@map("skill_endorsements")
}

enum MentorshipStatus {
  REQUESTED
  ACCEPTED
  ACTIVE
  COMPLETED
  CANCELLED
}

model MentorshipRequest {
  id          String   @id @default(uuid())
  trainee_id  String
  skill_id    String
  preferred_mode String               // online | onsite
  goal        String?
  status      MentorshipStatus @default(REQUESTED)
  created_at  DateTime @default(now())

  matches MentorshipMatch[]
  @@map("mentorship_requests")
}

model MentorshipMatch {
  id           String   @id @default(uuid())
  request_id   String
  mentor_id    String
  status       MentorshipStatus @default(REQUESTED)
  matched_at   DateTime @default(now())
  accepted_at  DateTime?
  ended_at     DateTime?

  request MentorshipRequest @relation(fields: [request_id], references: [id])
  pair    MentorshipPair?

  @@map("mentorship_matches")
}

model MentorshipPair {
  id          String   @id @default(uuid())
  match_id    String   @unique
  mentor_id   String
  trainee_id  String
  skill_id    String
  goal        String?
  start_date  DateTime
  end_date    DateTime?
  is_active   Boolean  @default(true)

  match MentorshipMatch @relation(fields: [match_id], references: [id])
  @@map("mentorship_pairs")
}
```

## 4. Anti-Gaming

- Endorsement จาก wallet ที่ไม่เคยทำงาน/เรียนใน SkillChain → น้ำหนัก = 0
- Endorsement จาก wallet ใหม่ < 30 วัน → ทำเครื่องหมาย "unverified"
- Detection: หาก A ↔ B endorse กันไปมาในหลาย skill → flag
- Endorsement จะถูกแสดงพร้อม **คุณภาพของ endorser** (level, jobs ที่ทำ) เพื่อให้ผู้ดูตัดสินเอง

## 5. UX

### Endorsement
- ปุ่ม "👍 ยืนยันทักษะ" บน talent profile
- เลือก skill (autocomplete จาก skills ที่ endorsee อ้าง)
- ใส่ context (optional)
- confirm ผ่าน wallet sign

### Mentor Pairing
- หน้า `/student/mentorship/request`
- หน้า `/teacher/mentorship/inbox` — รับ request, accept/reject
- Dashboard pair active ทั้งสองฝั่ง

## 6. Dependencies
- ต้องการ: [skill-taxonomy](skill-taxonomy.md)
- เสริม: [talent-directory](talent-directory.md) (แสดง endorsement บน profile)
