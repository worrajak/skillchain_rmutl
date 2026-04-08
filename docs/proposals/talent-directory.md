# Proposal: Public Talent Directory & Portfolio

> สถานะ: **DRAFT** | 2026-04-08
> Depends on: [skill-taxonomy.md](skill-taxonomy.md)

## 1. ปัญหา

ข้อมูล "คนเก่ง" กระจายในหลายตาราง — ไม่มีหน้า public ที่ค้นหาและตรวจสอบได้
เป้าหมายของโครงการคือเป็น **"ฐานข้อมูลคนเก่ง"** แต่ตอนนี้ยัง opaque

## 2. ข้อเสนอ

### 2.1 Public Talent Profile
หน้า `/talent/[handle]` เปิดสาธารณะ (opt-in) แสดง:
- ชื่อ (หรือ pseudonym), ภาพ, bio
- Credentials ที่ได้รับ + tx link
- Skills + proficiency (จาก [skill-taxonomy](skill-taxonomy.md))
- Portfolio: รูป/วิดีโอ/before-after ของงานสำเร็จ
- Reviews aggregate (ดาวเฉลี่ย, จำนวน)
- On-chain proofs (wallet, NFT count)
- Availability status

### 2.2 Search & Filter
หน้า `/talent` ค้นได้ตาม:
- Skill + minimum proficiency
- Credential level
- Location / campus
- Availability
- Rating
- Specialization (เช่น "solar rooftop", "ไฟ 3 เฟส")

### 2.3 Portfolio / Evidence Wall
ทุก `Job` และ `ModuleAssessment` แนบ evidence ได้:
- รูป (multiple)
- วิดีโอสั้น
- ไฟล์ (รายงาน/แบบ)
- ทุกไฟล์ hash → บันทึก `evidence_hash` on-chain เพื่อ tamper-proof

## 3. Schema (ร่าง)

```prisma
model TalentProfile {
  user_id      String   @id
  handle       String   @unique          // "/talent/somchai-elec"
  is_public    Boolean  @default(false)  // opt-in
  display_name String
  avatar_url   String?
  bio          String?
  headline     String?                   // "ช่างไฟฟ้า Solar Rooftop"
  specializations String[]               // tags
  view_count   Int      @default(0)
  updated_at   DateTime @updatedAt

  user User @relation(fields: [user_id], references: [id])
  @@map("talent_profiles")
}

model PortfolioItem {
  id          String   @id @default(uuid())
  user_id     String
  job_id      String?                    // ผูกกับงานจริง (ถ้ามี)
  title       String
  description String?
  media_urls  String[]                   // S3/Supabase storage
  evidence_hash String?                  // sha256 of media set
  on_chain_tx String?
  is_featured Boolean  @default(false)
  created_at  DateTime @default(now())

  user User @relation(fields: [user_id], references: [id])
  job  Job? @relation(fields: [job_id], references: [id])
  @@index([user_id])
  @@map("portfolio_items")
}
```

## 4. Privacy

- **Default = private** — นศ. ต้อง opt-in publish
- Granular: เลือกได้ว่าจะแสดงชื่อจริง / pseudonym
- ซ่อนงานเฉพาะรายการได้
- อนุญาตให้ "verifier" (employer ที่ logged in) เห็นรายละเอียดเพิ่มเติม

## 5. Verification Layer

ทุก credential / review / portfolio item ที่แสดงต้องมี **verification badge**:
- ✅ Verified on-chain — มี tx hash
- 🟡 Verified off-chain — มีในระบบแต่ยังไม่ขึ้น chain
- ❌ Unverified — self-claim

## 6. Use Cases

| ผู้ใช้ | ทำอะไร |
|---|---|
| Employer | search "ช่างไฟ Level 3 เชียงใหม่ ว่าง" → ดูประวัติ → จ้างตรง |
| Donor | ดูว่าเงินที่บริจาคสร้าง talent อะไรบ้าง |
| Partner (สพร./สคช.) | verify credential ผู้สมัครงานภายนอก |
| นศ. | สร้าง CV ออนไลน์ที่พิสูจน์ได้ |

## 7. Dependencies
- **ต้องการ:** [skill-taxonomy.md](skill-taxonomy.md) (สำหรับ search filter)
- **เป็น dependency ของ:** Verifiable Credential (W3C VC export)
