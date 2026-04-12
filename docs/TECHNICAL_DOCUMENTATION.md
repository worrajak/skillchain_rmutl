# เอกสารเทคนิคระบบ SkillChain RMUTL
## ระบบจับคู่งานและรับรองทักษะช่างเทคนิคบน Blockchain

**เวอร์ชัน:** 1.0  
**วันที่:** 12 เมษายน 2569  
**ผู้พัฒนา:** มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา  

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [สถาปัตยกรรมระบบ](#2-สถาปัตยกรรมระบบ)
3. [เทคโนโลยีที่ใช้](#3-เทคโนโลยีที่ใช้)
4. [โครงสร้างฐานข้อมูล](#4-โครงสร้างฐานข้อมูล)
5. [Smart Contract บน TRON](#5-smart-contract-บน-tron)
6. [ระบบจัดการผู้ใช้และสิทธิ์](#6-ระบบจัดการผู้ใช้และสิทธิ์)
7. [ระบบจัดการงาน](#7-ระบบจัดการงาน)
8. [ระบบประเมินผลและรับรองทักษะ](#8-ระบบประเมินผลและรับรองทักษะ)
9. [ระบบฝึกอบรม](#9-ระบบฝึกอบรม)
10. [ระบบแจ้งเตือน (Telegram Bot)](#10-ระบบแจ้งเตือน)
11. [ระบบ QR Code เช็คอิน](#11-ระบบ-qr-code-เช็คอิน)
12. [ระบบรักษาความปลอดภัย](#12-ระบบรักษาความปลอดภัย)
13. [API Reference](#13-api-reference)
14. [รายการหน้าจอ (Screen Inventory)](#14-รายการหน้าจอ)
15. [การติดตั้งและ Deploy](#15-การติดตั้งและ-deploy)

---

## 1. ภาพรวมระบบ

SkillChain RMUTL เป็นระบบเว็บแอปพลิเคชันสำหรับ **จับคู่งานช่างเทคนิค รับรองทักษะวิชาชีพ และบริหารจัดการค่าตอบแทนผ่าน Blockchain** โดยมีกลุ่มผู้ใช้หลัก 8 บทบาท ครอบคลุม 7 วิทยาเขตของ มทร.ล้านนา

### คุณสมบัติหลัก
- ระบบจับคู่งาน (Job Matching) พร้อม Escrow ค่าจ้างบน TRON Blockchain
- ระบบรับรองทักษะ 5 ระดับ (Credential Level 1-5)
- ระบบประเมินผล 3 มิติ (อาจารย์ + ผู้จ้าง + พี่เลี้ยง)
- ระบบฝึกอบรม (Training) พร้อมออกใบรับรอง
- ระบบ QR Code เช็คอิน/เช็คเอาท์พร้อม GPS
- แจ้งเตือนผ่าน Telegram Bot
- PDPA Consent ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล

---

## 2. สถาปัตยกรรมระบบ

```
┌──────────────────────────────────────────────────┐
│                   Frontend                        │
│  Next.js 16 + React 19 + TypeScript              │
│  Tailwind CSS + shadcn/ui                         │
│  45 หน้าจอ + 35 Components                       │
├──────────────────────────────────────────────────┤
│                   Backend                         │
│  Next.js API Routes (30 endpoints)               │
│  Supabase Auth (Cookie-based SSR)                │
│  Rate Limiting + Auth Guard                       │
├──────────────────────────────────────────────────┤
│                   Database                        │
│  PostgreSQL (Supabase)                            │
│  24 Models + 18 Enums                             │
│  Row-Level Security (32 ตาราง)                    │
├──────────────────────────────────────────────────┤
│                   Blockchain                      │
│  TRON Network (Nile Testnet)                      │
│  TRPBToken (TRC-20) + JobEscrow Contract          │
├──────────────────────────────────────────────────┤
│                External Services                  │
│  Telegram Bot (@SkillChainRMUTLBot)              │
│  Supabase Storage (รูปภาพ)                       │
│  Supabase Realtime (แชท + แจ้งเตือน)             │
└──────────────────────────────────────────────────┘
```

---

## 3. เทคโนโลยีที่ใช้

| หมวด | เทคโนโลยี | เวอร์ชัน |
|------|-----------|---------|
| Framework | Next.js | 16.2.2 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | 5.x |
| CSS | Tailwind CSS | 4.x |
| UI Components | shadcn/ui | latest |
| Database | PostgreSQL (Supabase) | 15 |
| ORM | Prisma | 7.6.0 |
| Authentication | Supabase Auth | 2.101.1 |
| Blockchain | TronWeb | 6.2.2 |
| QR Code | qrcode | 1.5.4 |
| State Management | Zustand | 5.0.12 |
| Validation | Zod | 4.3.6 |
| Toast | Sonner | latest |
| Icons | Lucide React | latest |

---

## 4. โครงสร้างฐานข้อมูล

### 4.1 ตารางหลัก (24 Models)

| # | ตาราง | คำอธิบาย | จำนวน Column |
|---|-------|---------|-------------|
| 1 | users | ผู้ใช้ทั้งหมด (8 roles) | 20+ |
| 2 | student_tiers | ระดับขั้น นศ. (trainee/apprentice/certified) | 8 |
| 3 | student_credentials | ใบรับรองทักษะ 5 ระดับ | 12 |
| 4 | student_qualifications | คุณสมบัติ/แบดจ์ | 10 |
| 5 | student_availability | สถานะพร้อมรับงาน | 6 |
| 6 | jobs | งาน (จับคู่ + Escrow) | 25+ |
| 7 | job_assignment_requests | คำขอรับงาน | 8 |
| 8 | job_cancellation_requests | คำขอยกเลิกงาน | 8 |
| 9 | job_agreements | ข้อตกลงการทำงาน | 10 |
| 10 | job_checkins | เช็คอิน/เช็คเอาท์ + GPS | 8 |
| 11 | evaluations | การประเมินจากอาจารย์ | 12 |
| 12 | employer_reviews | รีวิวจากผู้จ้าง | 10 |
| 13 | student_reviews | รีวิวจาก นศ. | 10 |
| 14 | mentor_reviews | รีวิวจากพี่เลี้ยง | 10 |
| 15 | behavior_logs | บันทึกพฤติกรรม | 8 |
| 16 | job_chat_rooms | ห้องแชทงาน | 5 |
| 17 | chat_messages | ข้อความแชท | 8 |
| 18 | chat_participants | สมาชิกห้องแชท | 5 |
| 19 | notifications | การแจ้งเตือน | 8 |
| 20 | donation_funds | กองทุนบริจาค | 8 |
| 21 | fee_config | ตั้งค่าอัตราค่าธรรมเนียม | 5 |
| 22 | disputes | ข้อพิพาท | 12 |
| 23 | training_courses | หลักสูตรอบรม | 15 |
| 24 | training_modules | โมดูลอบรม | 8 |
| 25 | training_enrollments | การลงทะเบียนอบรม | 8 |
| 26 | module_assessments | การประเมินโมดูล | 8 |
| 27 | training_attendance | เช็คชื่ออบรม (QR) | 6 |
| 28 | telegram_link_tokens | Token เชื่อมต่อ Telegram | 5 |
| 29 | approval_logs | ประวัติการอนุมัติ | 6 |

### 4.2 Enum Types (18 ประเภท)

| Enum | ค่าที่รองรับ |
|------|------------|
| UserRole | student, employer, admin, teacher, donor, superadmin, project_staff, rmutl_staff |
| ApprovalStatus | PENDING, APPROVED, REJECTED, SUSPENDED |
| JobStatus | PENDING_REVIEW, OPEN, ASSIGNED, IN_PROGRESS, SUBMITTED, COMPLETED, CANCELLED, DISPUTED |
| CredentialLevel | LEVEL_1 ถึง LEVEL_5 |
| JobType | PAID, VOLUNTEER, TRAINING, EXEMPTED |
| JobCategory | electrical, hvac, automotive, general |
| HiringMode | MODE_A (นศ.สมัคร), MODE_B (ผู้จ้างเลือก), MODE_C (staff มอบหมาย) |
| TierLevel | trainee, apprentice, certified |
| DisputeStatus | RAISED, UNDER_REVIEW, MEDIATION, RESOLVED |

### 4.3 Row-Level Security (RLS)

ใช้ **RLS Policies** ครอบคลุมทุกตาราง (32 ตาราง) พร้อม Helper Functions:
- `get_my_role()` — ดึง role ของผู้ใช้ปัจจุบัน
- `is_staff()` — ตรวจว่าเป็น staff/admin/teacher
- `is_admin()` — ตรวจว่าเป็น admin/superadmin

**หลักการ:**
- ผู้ใช้เห็นเฉพาะข้อมูลของตัวเอง
- Staff/Admin เห็นข้อมูลทั้งหมด
- ข้อมูลสาธารณะ (งาน, หลักสูตร, ใบรับรอง) ทุกคนเห็น

---

## 5. Smart Contract บน TRON

### 5.1 TRPBToken (TRC-20)
- **Address:** TAj5Fy9GHSG4h6FuyHt9BLEDyFmqqPyFBt
- **Standard:** TRC-20 (เทียบเท่า ERC-20)
- **อัตราแลกเปลี่ยน:** 1 TRPB = 1 THB
- **ฟังก์ชัน:** transfer, approve, mint, burn, collectFees

### 5.2 JobEscrow
- **Address:** TPDJ6DzbYGeEkjZyp7VpC95cLizPXEgWT5
- **หน้าที่:** ฝากค่าจ้างระหว่างทำงาน ปล่อยเมื่อเสร็จ

**การแบ่งค่าจ้าง (Escrow Release):**

| ส่วน | สัดส่วน | รายละเอียด |
|------|---------|-----------|
| นักศึกษา | 85% | ค่าจ้างหลัก |
| กองทุนกลาง | 5% | สมทบกองทุน |
| พี่เลี้ยง | 5% | ค่าตอบแทนพี่เลี้ยง (ถ้ามี) |
| Staff | 5% | ค่าดำเนินการ |

### 5.3 Flow การชำระเงิน

```
ผู้จ้าง → ฝาก TRPB เข้า Escrow → นศ.ทำงาน → ส่งงาน → 
ผู้จ้าง+Staff ยืนยัน → Escrow ปล่อยเงินอัตโนมัติ → แบ่งตามสัดส่วน
```

---

## 6. ระบบจัดการผู้ใช้และสิทธิ์

### 6.1 บทบาทผู้ใช้ (8 Roles)

| Role | คำอธิบาย | สิทธิ์หลัก |
|------|---------|-----------|
| student | นักศึกษา มทร.ล้านนา | สมัครงาน, รับงาน, ส่งงาน, เช็คอิน |
| employer | ผู้ว่าจ้างภายนอก | โพสต์งาน, จ้างงาน, ประเมิน นศ. |
| teacher | อาจารย์ | ประเมินผล, สร้างหลักสูตร, ออกใบรับรอง |
| project_staff | คณะทำงานใต้ร่มพระบารมี | อนุมัติงาน, จัดการระบบ |
| rmutl_staff | คณะทำงาน มทร.ล้านนา | อนุมัติงาน, ว่าจ้างเทียม |
| admin | ผู้ดูแลระบบ | จัดการทุกอย่าง |
| superadmin | ผู้ดูแลระบบสูงสุด | จัดการทุกอย่าง + ตั้งค่าระบบ |
| donor | ผู้บริจาค | บริจาคกองทุน, ดูรายงาน |

### 6.2 วิทยาเขตที่รองรับ (8 แห่ง)

| รหัส | วิทยาเขต |
|------|---------|
| huaykaew | เชียงใหม่ (ห้วยแก้ว) |
| doisaket | เชียงใหม่ (ดอยสะเก็ด) |
| chiangrai | เชียงราย |
| lampang | ลำปาง |
| tak | ตาก |
| nan | น่าน |
| phitsanulok | พิษณุโลก |
| external | ภายนอก |

### 6.3 ขั้นตอนการลงทะเบียน

```
1. กรอกข้อมูล + เลือก Role + เลือกวิทยาเขต
2. ยอมรับ PDPA Consent (บังคับ)
3. Rate Limit Check (3 ครั้ง/ชม.)
4. Supabase Auth สร้างบัญชี
5. สถานะ: PENDING → รอ Admin/Staff อนุมัติ
6. อนุมัติ → สร้าง TRON Wallet อัตโนมัติ
7. เข้าใช้งานได้
```

---

## 7. ระบบจัดการงาน

### 7.1 Job Status Flow (วงจรชีวิตงาน)

```
PENDING_REVIEW → OPEN → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED
                  ↓         ↓           ↓            ↓
              CANCELLED  CANCELLED   CANCELLED     DISPUTED
```

### 7.2 ประเภทงาน

| ประเภท | คำอธิบาย |
|--------|---------|
| PAID | มีค่าจ้าง (ผ่าน TRPB Escrow) |
| VOLUNTEER | จิตอาสา (ไม่มีค่าจ้าง) |
| TRAINING | ฝึกงาน (มีพี่เลี้ยง) |
| EXEMPTED | งานยกเว้น |

### 7.3 โหมดการจ้าง

| โหมด | คำอธิบาย |
|------|---------|
| MODE_A | นศ.สมัครเอง → Staff อนุมัติ |
| MODE_B | ผู้จ้างเลือก นศ. → Staff อนุมัติ |
| MODE_C | Staff มอบหมาย นศ. โดยตรง |

### 7.4 หมวดหมู่งาน

- ไฟฟ้า (electrical)
- เครื่องปรับอากาศ (hvac)
- ยานยนต์ (automotive)
- ทั่วไป (general)

---

## 8. ระบบประเมินผลและรับรองทักษะ

### 8.1 การประเมิน 3 มิติ

**อาจารย์ (Evaluation):**
| เกณฑ์ | น้ำหนัก |
|-------|---------|
| ทักษะเทคนิค (technical_skill) | 40% |
| ความปลอดภัย (safety_awareness) | 30% |
| จรรยาบรรณ (work_ethics) | 20% |
| การสื่อสาร (communication) | 10% |

**ผู้จ้าง (Employer Review) — ดาว 1-5:**
- คุณภาพงาน (score_quality)
- ความตรงเวลา (score_punctuality)
- ทัศนคติ (score_attitude)

**พี่เลี้ยง (Mentor Review) — ดาว 1-5:**
- ความพยายาม (score_effort)
- ความปลอดภัย (score_safety)
- พัฒนาทักษะ (score_skill_dev)

### 8.2 ระดับ Credential (5 ระดับ)

| ระดับ | ชื่อ | เงื่อนไข |
|-------|-----|---------|
| LEVEL_1 | ลงทะเบียน | ลงทะเบียนในระบบ |
| LEVEL_2 | ผ่านฝึกอบรม | ผ่านหลักสูตรอบรม |
| LEVEL_3 | อาจารย์รับรอง | อาจารย์ประเมินผ่าน |
| LEVEL_4 | สถาบันชาติรับรอง | DSD/TPQI รับรอง |
| LEVEL_5 | ช่างชำนาญการ | ช่างที่มีประสบการณ์สูง |

---

## 9. ระบบฝึกอบรม

### 9.1 ขั้นตอน

```
1. อาจารย์/Staff สร้างหลักสูตร (title, modules, ระดับ credential)
2. เปิดรับสมัคร (OPEN_ENROLLMENT)
3. นศ. ลงทะเบียน (ตรวจ capacity)
4. เริ่มอบรม (IN_PROGRESS) — เช็คชื่อด้วย QR
5. ประเมินรายโมดูล (PASS/FAIL + คะแนน)
6. ผ่านทุกโมดูล → ออกใบรับรอง (TC-xxxx)
7. เลื่อน Credential Level อัตโนมัติ
```

### 9.2 ตรวจสอบใบรับรอง

หน้า `/verify` — ใส่เลขที่ใบรับรอง (TC-xxxx) → แสดงข้อมูลผู้ผ่านอบรม, หลักสูตร, วันที่สำเร็จ

---

## 10. ระบบแจ้งเตือน

### 10.1 Telegram Bot (@SkillChainRMUTLBot)

**คำสั่ง Bot:**
| คำสั่ง | หน้าที่ |
|--------|---------|
| /start <token> | เชื่อมต่อบัญชี SkillChain |
| /status | เช็คสถานะการเชื่อมต่อ |
| /stop | หยุดรับแจ้งเตือน |

### 10.2 ประเภทแจ้งเตือน (12 ประเภท)

| ประเภท | เหตุการณ์ |
|--------|---------|
| job_assigned | ได้รับมอบหมายงาน |
| job_rejected | คำขอรับงานถูกปฏิเสธ |
| schedule_proposed | เสนอกำหนดการทำงาน |
| job_started | เริ่มทำงาน |
| job_submitted | ส่งงานแล้ว |
| job_completed | งานเสร็จสิ้น |
| completion_pending | รอยืนยันจากอีกฝ่าย |
| job_checkin | เช็คอิน/เช็คเอาท์ |
| dispute | มีข้อพิพาท |
| dispute_resolved | ข้อพิพาทตัดสินแล้ว |
| agreement | ข้อตกลงได้รับการตอบรับ |
| approval | บัญชีได้รับอนุมัติ |

---

## 11. ระบบ QR Code เช็คอิน

### 11.1 QR สำหรับงาน
- ผู้จ้าง/Staff สร้าง QR Code จากหน้างาน
- นศ. สแกน QR → เปิดหน้า /checkin → กดเช็คอิน/เช็คเอาท์
- บันทึก GPS ตำแหน่ง + เวลา
- แจ้งเตือนผู้จ้างผ่าน Telegram

### 11.2 QR สำหรับอบรม
- อาจารย์/Staff สร้าง QR Code จากหน้าประเมิน
- นศ. สแกน → เช็คชื่อเข้าเรียน/ออก
- บันทึกใน training_attendance

---

## 12. ระบบรักษาความปลอดภัย

### 12.1 Authentication
- Supabase Auth (Cookie-based SSR)
- Session อัตโนมัติผ่าน Middleware

### 12.2 Authorization
- Role-based Access Control (8 roles)
- API Route ทุกเส้นตรวจสอบ role ก่อนดำเนินการ
- Field Whitelisting สำหรับ PATCH endpoints
- Job Status State Machine Validation

### 12.3 Row-Level Security (RLS)
- ทุกตาราง (32 ตาราง) มี RLS Policy
- Helper Functions: get_my_role(), is_staff(), is_admin()
- ไม่มี allow_all policy

### 12.4 Rate Limiting

| จุดป้องกัน | Limit |
|---|---|
| Login | 5 ครั้ง / 15 นาที / IP |
| Register | 3 ครั้ง / ชั่วโมง / IP |
| API เขียน | 30 ครั้ง / นาที / IP |
| Telegram Link | 5 ครั้ง / ชั่วโมง / IP |

### 12.5 การเข้ารหัส
- Wallet Private Key: AES-256-GCM + SHA-256 Key Derivation
- Content Hash: SHA-256 สำหรับ dispute/review integrity

### 12.6 PDPA Compliance
- Consent checkbox บังคับตอนลงทะเบียน
- บันทึก pdpa_consented_at + pdpa_version
- นโยบายระบุข้อมูลที่เก็บ, วัตถุประสงค์, สิทธิ์เจ้าของข้อมูล

### 12.7 Input Validation
- Score range: 1-5 ทุกการประเมิน
- Pay amount: 0-1,000,000 TRPB
- Status transition: ตามที่กำหนดใน State Machine เท่านั้น

---

## 13. API Reference

### 13.1 Auth APIs
| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| POST | /api/auth/login | Rate limit check ก่อน login |
| POST | /api/auth/register-check | Rate limit check ก่อน register |
| POST | /api/auth/logout | ออกจากระบบ |

### 13.2 Job APIs
| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| GET/PATCH/DELETE | /api/jobs/[id] | CRUD งาน |
| POST | /api/jobs/[id]/approve | Staff อนุมัติ นศ.รับงาน |
| POST | /api/jobs/[id]/schedule | เสนอ/ยืนยันกำหนดการ |
| POST | /api/jobs/[id]/submit | นศ.ส่งงาน |
| POST | /api/jobs/[id]/confirm-completion | ยืนยันงานเสร็จ |
| POST | /api/jobs/[id]/cancel | ขอยกเลิกงาน |
| POST | /api/jobs/[id]/review-job | Staff รีวิวงานก่อนเผยแพร่ |
| POST | /api/jobs/[id]/release-escrow | ปล่อย Escrow |
| POST | /api/jobs/[id]/record-payment | บันทึกการจ่ายเงิน |

### 13.3 Evaluation & Review APIs
| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| GET/POST | /api/evaluations | ประเมินผลจากอาจารย์ |
| GET/POST | /api/reviews | รีวิว (employer/student/mentor) |

### 13.4 Training APIs
| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| GET/POST | /api/training | สร้าง/ค้นหาหลักสูตร |
| GET/PATCH | /api/training/[id] | รายละเอียด/อัปเดตหลักสูตร |
| POST | /api/training/[id]/enroll | ลงทะเบียนอบรม |
| POST | /api/training/[id]/assess | ประเมินรายโมดูล |

### 13.5 Communication APIs
| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| GET/POST | /api/chat/[jobId] | ห้องแชทงาน |
| GET/POST | /api/chat/[jobId]/messages | ข้อความแชท |
| POST | /api/chat/[jobId]/agreement | ข้อตกลงการทำงาน |
| GET/POST | /api/disputes | ข้อพิพาท |
| POST | /api/disputes/[id]/resolve | ตัดสินข้อพิพาท |
| GET/PATCH | /api/notifications | แจ้งเตือน |

### 13.6 Check-in & Telegram APIs
| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| GET/POST | /api/checkin | เช็คอิน/เช็คเอาท์ |
| GET | /api/checkin/qr | สร้าง QR Code |
| GET/POST/DELETE | /api/telegram/link | เชื่อมต่อ/ยกเลิก Telegram |
| POST | /api/telegram/webhook | Telegram Bot webhook |

### 13.7 User & Other APIs
| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| POST | /api/users/[id]/approve | อนุมัติผู้ใช้ + สร้าง Wallet |
| GET | /api/employers/[id]/quota | โควตาจ้าง นศ. |

---

## 14. รายการหน้าจอ

### 14.1 หน้าสาธารณะ (5 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 1 | / | หน้าแรก |
| 2 | /about | เกี่ยวกับระบบ |
| 3 | /jobs | ค้นหางาน |
| 4 | /training | หลักสูตรอบรม |
| 5 | /verify | ตรวจสอบใบรับรอง |

### 14.2 Authentication (3 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 6 | /login | เข้าสู่ระบบ |
| 7 | /register | ลงทะเบียน (ทุก role) |
| 8 | /register-trainee | ลงทะเบียนช่างภายนอก |

### 14.3 นักศึกษา (5 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 9 | /student/dashboard | แดชบอร์ด + งานของฉัน |
| 10 | /student/jobs | ค้นหางาน/สมัครงาน |
| 11 | /student/profile | โปรไฟล์ + Telegram |
| 12 | /student/wallet | กระเป๋าเงิน TRPB |
| 13 | /checkin | เช็คอิน (QR) |

### 14.4 ผู้ว่าจ้าง (5 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 14 | /employer/dashboard | แดชบอร์ด |
| 15 | /employer/jobs | รายการงาน |
| 16 | /employer/jobs/new | สร้างงานใหม่ |
| 17 | /employer/jobs/[id] | รายละเอียดงาน + QR |
| 18 | /employer/students | ค้นหานักศึกษา |

### 14.5 อาจารย์ (3 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 19 | /teacher/evaluation | ประเมินผล |
| 20 | /teacher/pending | งานรอประเมิน |
| 21 | /teacher/students | รายชื่อ นศ. |

### 14.6 Project Staff (7 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 22 | /project-staff/dashboard | แดชบอร์ด |
| 23 | /project-staff/approvals | อนุมัติ นศ./ผู้จ้าง |
| 24 | /project-staff/review-jobs | ตรวจงานก่อนเผยแพร่ |
| 25 | /project-staff/active-jobs | งานที่กำลังดำเนินการ |
| 26 | /project-staff/cancellations | คำขอยกเลิก |
| 27 | /project-staff/disputes | ข้อพิพาท |
| 28 | /project-staff/employers | ผู้ว่าจ้าง |

### 14.7 Admin (10 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 29 | /admin/dashboard | แดชบอร์ดรวม |
| 30 | /admin/users | จัดการผู้ใช้ |
| 31 | /admin/approvals | อนุมัติบัญชี |
| 32 | /admin/jobs | จัดการงานทั้งหมด |
| 33 | /admin/disputes | จัดการข้อพิพาท |
| 34 | /admin/reviews | ตรวจสอบรีวิว |
| 35 | /admin/credentials | จัดการใบรับรอง |
| 36 | /admin/tier | จัดการระดับขั้น |
| 37 | /admin/fees | ตั้งค่าค่าธรรมเนียม |
| 38 | /admin/reports | รายงาน |

### 14.8 ผู้บริจาค (3 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 39 | /donor/donate | บริจาค |
| 40 | /donor/audit | ตรวจสอบการใช้เงิน |
| 41 | /donor/impact | ผลกระทบการบริจาค |

### 14.9 ฝึกอบรม (4 หน้า)
| # | Path | คำอธิบาย |
|---|------|---------|
| 42 | /training | แคตตาล็อกหลักสูตร |
| 43 | /training/[id] | รายละเอียด + ลงทะเบียน |
| 44 | /training/manage/new | สร้างหลักสูตร |
| 45 | /training/manage/[id]/assess | ประเมินรายโมดูล + QR |

**รวมทั้งหมด: 45 หน้าจอ**

---

## 15. การติดตั้งและ Deploy

### 15.1 ความต้องการของระบบ
- Node.js 20+
- PostgreSQL 15+ (Supabase)
- TRON Wallet (Nile Testnet)

### 15.2 ขั้นตอนติดตั้ง

```bash
# 1. Clone repository
git clone https://github.com/worrajak/skillchain_rmutl.git
cd skillchain-web3

# 2. ติดตั้ง dependencies
npm install

# 3. ตั้งค่า environment (.env.local)
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=<database-url>
WALLET_ENCRYPTION_KEY=<encryption-key>
TRON_DEPLOYER_PRIVATE_KEY=<tron-private-key>
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_BOT_USERNAME=SkillChainRMUTLBot
NEXT_PUBLIC_APP_URL=https://skillchain-rmutl.vercel.app

# 4. รัน SQL Migrations (ตามลำดับ)
# Supabase SQL Editor:
# - manual_avatar_url.sql
# - manual_job_review.sql
# - manual_training_system.sql
# - manual_rls_policies.sql
# - manual_telegram.sql
# - manual_qr_pdpa.sql

# 5. Build & Run
npm run build
npm start
```

### 15.3 Deploy (Vercel)
- Push ไปที่ GitHub → Vercel auto-deploy
- ตั้ง Environment Variables ใน Vercel Dashboard
- ตั้ง Telegram Webhook:
  ```
  curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook"
  ```

---

## ภาคผนวก

### A. โครงสร้างไฟล์โปรเจค

```
skillchain-web3/
├── prisma/
│   ├── schema.prisma          # Database schema (24 models, 18 enums)
│   └── migrations/            # 10 SQL migration files
├── contracts/
│   ├── TRPBToken.sol          # TRC-20 Token (102 lines)
│   └── JobEscrow.sol          # Escrow Contract (152 lines)
├── src/
│   ├── app/
│   │   ├── api/               # 30 API routes
│   │   ├── (auth)/            # Login, Register
│   │   ├── admin/             # 10 admin pages
│   │   ├── employer/          # 5 employer pages
│   │   ├── student/           # 4 student pages
│   │   ├── teacher/           # 3 teacher pages
│   │   ├── project-staff/     # 7 staff pages
│   │   ├── donor/             # 3 donor pages
│   │   ├── training/          # 4 training pages
│   │   ├── jobs/              # 2 job pages
│   │   ├── checkin/           # QR check-in page
│   │   └── verify/            # Certificate verification
│   ├── components/            # 35 reusable components
│   ├── lib/                   # 13 utility files
│   │   ├── supabase/          # Supabase client/server/middleware
│   │   ├── tron/              # TRON client + ABI files
│   │   ├── telegram.ts        # Telegram Bot library
│   │   ├── rate-limit.ts      # Rate limiter
│   │   ├── auth-guard.ts      # Auth/role checking
│   │   ├── crypto.ts          # AES-256-GCM encryption
│   │   └── credential.ts      # Content hashing
│   └── types/
│       └── database.ts        # Type definitions + campus labels
├── docs/
│   └── TECHNICAL_DOCUMENTATION.md  # เอกสารนี้
├── package.json
└── .env.local                 # Environment variables (ไม่รวมใน git)
```

### B. สรุปสถิติโปรเจค

| รายการ | จำนวน |
|--------|-------|
| หน้าจอ (Pages) | 45 |
| API Routes | 30 |
| Components | 35 |
| Database Models | 24+ |
| Enums | 18 |
| SQL Migrations | 10 |
| Smart Contracts | 2 |
| ผู้ใช้ Roles | 8 |
| วิทยาเขต | 8 |
| ประเภทแจ้งเตือน | 12 |
| Credential Levels | 5 |

---

*เอกสารนี้จัดทำสำหรับการตรวจรับโครงการ SkillChain มทร.ล้านนา*
