# Credential System (5 Levels)

ระบบ credential ของ SkillChain แบ่งทักษะนักศึกษาออกเป็น 5 ระดับ
แต่ละระดับรับรองโดย "ผู้รับรอง" (`CertifyingBody`) ที่ต่างกัน

## Levels

| Level | ชื่อ | ผู้รับรอง | ความหมาย |
|---|---|---|---|
| 1 | **Registered** | `SYSTEM` | สมัครและยืนยันตัวตนแล้ว |
| 2 | **Project Certified** | `PROJECT_BARAMEE` | ผ่านการอบรมจากโครงการใต้ร่มพระบารมี |
| 3 | **Teacher Certified** | `RMUTL_TEACHER` | อาจารย์ มทร.ล้านนา รับรองความสามารถ |
| 4 | **National Certified** | `DSD` / `TPQI` | กรมพัฒนาฝีมือแรงงาน หรือ สคช. รับรอง |
| 5 | **Master Technician** | `MASTER_TECH` | รับเหมา + สอน + รับรองผู้อื่นได้ |

## เกณฑ์เลื่อนระดับ (แนะนำ — ปรับได้)

| จาก → ไป | เกณฑ์ |
|---|---|
| 1 → 2 | ผ่านอบรมพื้นฐานของโครงการ + ทำ training jobs ≥ 3 งาน |
| 2 → 3 | คะแนนเฉลี่ย ≥ 4.0 + อาจารย์อนุมัติ + ไม่มี safety incident |
| 3 → 4 | สอบผ่านมาตรฐานฝีมือแรงงานแห่งชาติ (DSD) หรือ TPQI |
| 4 → 5 | ประสบการณ์ ≥ 2 ปี + สอน trainee อย่างน้อย 5 คน + อนุมัติพิเศษ |

## ตาราง `StudentCredential`

ดู [`prisma/schema.prisma`](../prisma/schema.prisma) ส่วน `StudentCredential`

ฟิลด์สำคัญ:
- `credential_level` — Level 1-5
- `certified_by` — body ที่รับรอง
- `certified_by_user_id` — user id ของผู้รับรอง (ถ้าเป็นบุคคล)
- `certificate_ref` — เลขใบรับรองภายนอก (ถ้ามี)
- `nft_tx_hash` — tx hash ของ NFT credential บน TRON
- `expires_at` — บางระดับมีหมดอายุ
- `is_active` — ถูก revoke ได้

## NFT Credential

เมื่อเลื่อนระดับสำเร็จ ระบบจะ mint NFT credential บน TRON Nile
- Token URI ชี้ไปยัง metadata (ภาพ + ข้อมูล)
- บันทึก `nft_tx_hash` ลง DB
- ใช้ตรวจสอบจากภายนอกได้ผ่าน explorer

## สิทธิ์ที่ผูกกับ Level

| Level | สิทธิ์เพิ่ม |
|---|---|
| 1 | สมัครงาน TRAINING / VOLUNTEER |
| 2 | สมัคร PAID jobs ภายใต้กรอบ MODE_C |
| 3 | สมัคร PAID jobs ทุก mode + เป็น mentor ระดับ trainee |
| 4 | รับงานมูลค่าสูง + ได้รับการแนะนำสู่ employer ภายนอก |
| 5 | เปิดงานเอง (รับเหมาช่วง) + รับรอง Level 1-2 ของผู้อื่น |
