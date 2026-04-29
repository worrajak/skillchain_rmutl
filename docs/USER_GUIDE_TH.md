# คู่มือผู้ใช้ — SkillChain RMUTL

คู่มือการใช้งานสำหรับแต่ละ role ที่เข้าใช้ระบบ
หลัง login ทุก role จะเข้าหน้า `/[role]/dashboard` ของตัวเองอัตโนมัติ

---

## 📋 สารบัญ

- [ภาพรวม Flow](#ภาพรวม-flow)
- [Admin (ผู้ดูแลระบบ)](#admin)
- [คณะทำงานใต้ร่มฯ (project_staff)](#project_staff)
- [ผู้ว่าจ้าง (employer)](#employer)
- [นักศึกษา (student)](#student)
- [อาจารย์ (teacher)](#teacher)
- [ผู้บริจาค (donor)](#donor)
- [TRPB Wallet](#trpb-wallet)
- [QR Quick Login](#qr-quick-login)

---

## ภาพรวม Flow

### ลำดับการจ่าย TRPB

```
1. Admin → SYSTEM Pool (1,000,000 TRPB)
        ↓ จ่ายผ่าน /admin/trpb
2. คณะทำงานใต้ร่มฯ (รับโควต้า)
        ↓ กระจายผ่าน /project-staff/trpb
3. ผู้ว่าจ้าง (มี TRPB ใช้จ้างงาน)
        ↓ Hold ใน Escrow ตอนสร้างงาน
4. นักศึกษา (รับเมื่องานเสร็จ + staff ปล่อย Escrow)
```

### ลำดับ Job Lifecycle

```
1. ผู้ว่าจ้างสร้างงาน         → PENDING_REVIEW
2. คณะทำงานพิจารณา + อนุมัติ  → OPEN
3. นศ. ส่งคำขอรับงาน         → (รอ approve)
4. คณะทำงาน approve         → ASSIGNED
5. ผู้ว่าจ้าง+นศ. นัดวันทำงาน  → CONFIRMED
6. นศ. เริ่มทำงาน + อัพรูป    → IN_PROGRESS
7. นศ. ส่งมอบงาน             → SUBMITTED
8. ผู้ว่าจ้าง + คณะทำงาน ยืนยัน → COMPLETED
9. คณะทำงานปล่อย TRPB         → IN_WARRANTY (7 วัน)
10. ผ่านประกัน                → CLOSED
```

---

## Admin

### หน้าหลัก: `/admin/dashboard`

Admin ดูแลระบบทั้งหมด + จัดการ TRPB pool

### หน้าที่ใช้บ่อย

| หน้า | ทำอะไร |
|---|---|
| `/admin/dashboard` | สถิติรวม + งานล่าสุด + ผู้ใช้ใหม่ |
| `/admin/approvals` | อนุมัติผู้ใช้ที่สมัครใหม่ (นศ. / employer) |
| `/admin/users` | จัดการผู้ใช้ทั้งหมด + ตั้งสิทธิ์ |
| `/admin/jobs` | ดูงานทั้งหมดในระบบ |
| **`/admin/trpb`** | **จัดการ TRPB pool** (1,000,000 TRPB) |
| **`/admin/wallets`** | **ผูก TRON wallet ให้ user** (Nile testnet) |
| `/admin/credentials` | ดู NFT credentials ที่ออกให้ นศ. |
| `/admin/reports` | รายงานสถิติเชิงลึก |

### จ่าย TRPB ให้คณะทำงาน

1. ไป `/admin/trpb` → เห็น **SYSTEM Pool 1,000,000 TRPB**
2. ในการ์ด "จ่าย TRPB จาก Pool":
   - เลือกผู้รับ → เลือก project_staff (เช่น "อ้ายแก้ว")
   - จำนวน → เช่น 50,000
   - เหตุผล → "โควต้าโครงการ Phase 1"
3. กดปุ่มสีน้ำเงิน "จ่ายจาก Pool"
4. Toast แจ้งสำเร็จ + balance ของ user ปรับทันที

### ผูก TRON wallet ให้ user

1. ไป `/admin/wallets`
2. เลือก user ที่ยังไม่มี wallet (bg ส้ม)
3. กด "เพิ่ม wallet"
4. ใส่ TRON address (ขึ้นต้น `T` + 33 ตัว) — เช่น `TU7VbE...`
5. กด save → ระบบ validate format + ตรวจไม่ซ้ำกับใคร

**สร้าง TRON wallet ใหม่:**
1. ติดตั้ง [TronLink Extension](https://www.tronlink.org/) ใน Chrome/Brave
2. สร้าง account → เปลี่ยน network เป็น **Nile Testnet** (มุมขวาบน)
3. Copy address → ใส่ใน admin/wallets
4. ขอ TRX ฟรีจาก [Nile Faucet](https://nileex.io/join/getJoinPage)

---

## project_staff

### หน้าหลัก: `/project-staff/dashboard`

คณะทำงานใต้ร่มฯ — กำกับงาน + กระจาย TRPB + ปล่อย Escrow

### หน้าที่ใช้บ่อย

| หน้า | ทำอะไร |
|---|---|
| `/project-staff/dashboard` | สรุปงานที่กำกับ + งานรอดำเนินการ |
| `/project-staff/review-jobs` | พิจารณางานใหม่ของผู้ว่าจ้าง (อนุมัติให้เปิดรับ) |
| `/project-staff/approvals` | อนุมัติคำขอรับงานของ นศ. |
| `/project-staff/active-jobs` | ติดตามงานที่กำลังดำเนินการทั้งหมด |
| **`/project-staff/trpb`** | **จ่าย TRPB ให้ผู้ว่าจ้าง** |
| `/project-staff/employers` | ดูโควต้า + จัดการผู้ว่าจ้าง |
| `/project-staff/warranty` | ติดตามงานในประกัน 7 วัน |
| `/project-staff/disputes` | จัดการข้อพิพาท |
| `/staff/gov` | จัดการเอกสารราชการ (กิจกรรม + เบิก) |

### จ่าย TRPB ให้ผู้ว่าจ้าง

1. ไป `/project-staff/trpb` → เห็นยอด TRPB ของคุณ (ที่ admin จ่ายให้)
2. ในตาราง "ผู้ว่าจ้างทั้งหมด":
   - กดปุ่ม **"โอน"** ข้างชื่อผู้ว่าจ้างที่ต้องการจ่าย
   - หรือเลือกจาก dropdown ในฟอร์ม
3. กรอกจำนวน + เหตุผล → กด "โอน TRPB"
4. ผู้ว่าจ้างได้ TRPB เพิ่ม + ใช้จ้างงานได้ทันที

> **ข้อจำกัด**: 100,000 TRPB ต่อครั้ง (admin จ่ายได้ 1,000,000 ต่อครั้ง)

### อนุมัติงานใหม่

1. ผู้ว่าจ้างสร้างงาน → status `PENDING_REVIEW`
2. คุณไป `/project-staff/review-jobs`
3. คลิกงาน → ดูรายละเอียด + รูป + ค่าจ้าง
4. ตัดสินใจ:
   - **อนุมัติ** (อาจปรับค่าจ้าง) → status เป็น `OPEN` ให้ นศ. สมัคร
   - **ปฏิเสธ** + ระบุเหตุผล → status `CANCELLED`

### อนุมัติให้ นศ. รับงาน

1. นศ. ส่งคำขอ → คุณได้ notification
2. ไป `/project-staff/approvals`
3. ดูคำขอ + รายชื่อ นศ. ที่สมัคร (อาจมีหลายคน)
4. กด **"อนุมัติ"** ให้ 1 คน → status `ASSIGNED` + คุณกลายเป็น **ผู้กำกับ**
5. หน้านี้ + `/project-staff/active-jobs` แสดงงานที่คุณกำกับด้วย highlight สีอำพัน

### ปล่อย Escrow (จ่ายค่าจ้าง)

หลังงาน COMPLETED:
1. ไป `/project-staff/active-jobs` → กรอง "เสร็จ"
2. กดที่งาน → เปิดหน้า detail
3. หา section **"จ่ายค่าจ้าง"** สีเหลือง-ส้ม
4. กดปุ่ม **"จ่ายค่าจ้าง XXX TRPB"**
5. ระบบจะ:
   - หัก TRPB จากผู้ว่าจ้าง
   - แบ่งให้ นศ. (90%) + กองทุน (5%) + คณะทำงาน (5%) [ถ้าไม่มี mentor]
   - หรือ 85/5/5/5 ถ้ามี mentor
6. ถ้าผู้ว่าจ้าง balance ไม่พอ → ระบบ auto top-up จาก SYSTEM (โหมดทดสอบ)

### ออกเอกสารราชการ

1. ไป `/staff/gov` → หรือ `/staff/gov/jobs/[jobId]`
2. ในการ์ด **"📄 เอกสารราชการ"** → กด **"ออกเอกสาร DOCX"**
3. ระบบสร้าง .docx (บันทึกขออนุมัติกิจกรรม) ภาษาไทย
4. Auto download + บันทึกใน Storage

> **หมายเหตุ**: gov workflow gates ถูก disable ใน pilot mode (`ENFORCE_GOV_GATE=false`)
> หากต้องการ enforce ให้ตั้ง env var + รัน manual_disable_gov_gates.sql กลับ

---

## employer

### หน้าหลัก: `/employer/dashboard`

ผู้ว่าจ้าง — สร้างงาน + จ่ายค่าจ้างผ่าน TRPB

### หน้าที่ใช้บ่อย

| หน้า | ทำอะไร |
|---|---|
| `/employer/dashboard` | งานของฉัน + สถิติ |
| `/employer/jobs/new` | สร้างงานใหม่ |
| `/employer/jobs` | งานทั้งหมด + แก้ไข |
| `/employer/jobs/[id]` | รายละเอียด + ยืนยันรับงาน + ประเมิน |
| `/wallet` | ดูยอด TRPB + ประวัติ |

### สร้างงานใหม่

1. ไป `/employer/jobs/new`
2. กรอก:
   - ชื่องาน + คำอธิบาย
   - ประเภท (PAID / VOLUNTEER / TRAINING / EXEMPTED)
   - หมวด (ไฟฟ้า / แอร์ / ยานยนต์ / ทั่วไป)
   - สถานที่ + วิทยาเขต
   - ค่าจ้าง (TRPB) — ถ้า PAID
   - กำหนดส่ง
3. **อัพรูปเครื่อง / ลักษณะงาน** (สูงสุด 4 รูป) — ช่วยให้ นศ. + staff ตัดสินใจได้
4. กด "ลงประกาศ" → status `PENDING_REVIEW`
5. รอคณะทำงานพิจารณา (~ไม่กี่ชม.)

### Flow ระหว่างทำงาน

| สถานะ | คุณเห็นอะไร / ทำอะไร |
|---|---|
| **PENDING_REVIEW** | งานรอพิจารณา — staff อาจปรับค่าจ้าง |
| **OPEN** | นศ. กำลังส่งคำขอเข้ามา (รอ staff อนุมัติ) |
| **ASSIGNED** | นศ. ที่ staff อนุมัติแล้ว — ฟอร์มนัดวันทำงาน |
| **CONFIRMED** | ยืนยันวันแล้ว — รอ นศ. เริ่มงาน |
| **IN_PROGRESS** | นศ. ทำงาน + อัพรูป — คุณดูได้ + ประเมิน Interim |
| **SUBMITTED** | 🎉 นศ. ส่งงาน — Hero card สีส้ม **"ยืนยันรับงาน"** ใหญ่ๆ |
| **COMPLETED** | ทั้ง 2 ฝ่ายยืนยัน → "รอคณะทำงานใต้ร่มฯ จ่าย TRPB" |
| **IN_WARRANTY / CLOSED** | งานเสร็จ + เปิด review form |

### นัดวันทำงาน (ASSIGNED)

1. ไป `/employer/jobs/[id]`
2. การ์ด "กำหนดวันทำงาน":
   - **คุณเสนอวันก่อน**: กรอก start/end date → กด "เสนอวันทำงาน" → รอ นศ. ยืนยัน
   - **นศ. เสนอมา**: เห็นวันที่ นศ. เสนอ → กด **"ยืนยันวันทำงาน"** → status เป็น `IN_PROGRESS`

### ยืนยันรับงาน (SUBMITTED)

หลัง นศ. ส่งงาน:
1. หน้า `/employer/jobs/[id]` แสดง **Hero card สีส้ม**
2. ดูรูปงานเสร็จ + รูประหว่างทำงาน
3. กดปุ่มเขียวใหญ่ **"ยืนยันรับงาน — งานเรียบร้อย"**
4. รอคณะทำงานใต้ร่มฯ ยืนยันด้วย → COMPLETED
5. หลัง COMPLETED → ฟอร์ม **ประเมินนักศึกษา** ปรากฏ

### ประเมิน นศ. (IN_PROGRESS + COMPLETED)

มีฟอร์มประเมิน 2 รอบ (ตามที่ตกลง):

| รอบ | เมื่อไหร่ | ประเภท |
|---|---|---|
| **Interim** | ขณะ IN_PROGRESS | "ระหว่างทำงาน" |
| **Final** | หลัง COMPLETED | "หลังงานเสร็จ" |

3 หัวข้อประเมิน: **คุณภาพงาน / ตรงเวลา / ทัศนคติ-มารยาท** (1-5 ดาว)
ถ้าประเมินแล้วแสดง "✅ ประเมินนักศึกษาแล้ว" + คะแนน — ไม่ให้แก้ซ้ำ

---

## student

### หน้าหลัก: `/student/dashboard`

นักศึกษา — รับงาน + ทำงาน + ส่งมอบ + รับ TRPB

### หน้าที่ใช้บ่อย

| หน้า | ทำอะไร |
|---|---|
| `/student/dashboard` | สรุปงานปัจจุบัน + งานเสร็จล่าสุด |
| `/student/jobs` | 2 tabs: 📌 งานของฉัน / 🔍 หางานทำ |
| `/student/jobs/[id]` | รายละเอียดงาน + อัพรูป + ส่งมอบงาน |
| `/student/profile` | ข้อมูลส่วนตัว + ทักษะ + ผลงาน |
| `/wallet` | ยอด TRPB + ประวัติ |
| `/training` | หลักสูตรอบรม |

### หางานทำ + สมัคร

1. ไป `/student/jobs` → tab **"🔍 หางานทำ"**
2. ค้นหา / กรองตามประเภท
3. คลิกงานที่สนใจ → ดูรายละเอียด + รูปเครื่อง + ผู้จ้าง
4. กด **"ส่งคำขอรับงาน"**
5. รอคณะทำงานอนุมัติ (~ไม่กี่ชม.)

### Flow หลังได้รับงาน

ไป `/student/jobs/[id]` ของงานที่ได้:

| สถานะ | คุณทำอะไร |
|---|---|
| **ASSIGNED** | นัดวันทำงานกับผู้จ้าง (เสนอ start/end date) |
| **CONFIRMED** | เริ่มอัพรูปได้ — รอวันเริ่มงาน |
| **IN_PROGRESS** | อัพรูประหว่างทำงาน + รูปงานเสร็จ |
| **CONFIRMED / IN_PROGRESS** | กดปุ่มเขียว **"ส่งมอบงาน"** เมื่อพร้อม |
| **SUBMITTED** | รอผู้จ้าง+คณะทำงานยืนยัน |
| **COMPLETED+** | ฟอร์มประเมินผู้จ้างปรากฏ |

### อัพรูปงาน

3 ประเภท:
- **รูประหว่างทำงาน** (progress) — สูงสุด 8 รูป
- **รูปงานเสร็จ** (completion) — สูงสุด 6 รูป **บังคับมีอย่างน้อย 1 รูปก่อนส่งงาน**

วิธี:
1. กด "เลือกรูป" → เลือก 1+ รูปจากเครื่อง
2. ดู preview → กด **"อัปโหลด N รูป"**
3. รูปเข้า Supabase Storage `job-images` bucket
4. ทุกฝ่ายเห็นทันที (ผู้จ้าง / staff)

### ส่งมอบงาน

1. อัพรูปงานเสร็จ ≥ 1 รูป (สำคัญ)
2. กดปุ่มเขียวใหญ่ **"ส่งมอบงาน"**
3. confirm dialog → ยืนยัน
4. status เป็น `SUBMITTED` — ระบบแจ้งผู้จ้าง + staff
5. รอ 2 ฝ่ายยืนยันรับงาน → COMPLETED → คุณได้รับ TRPB

### ประเมินผู้ว่าจ้าง

ฟอร์ม 2 รอบเหมือนผู้จ้างประเมินคุณ:
- Interim (IN_PROGRESS): ระหว่างทำงาน
- Final (COMPLETED+): หลังงานเสร็จ

3 หัวข้อ: **งานชัดเจน / จ่ายตรงเวลา / ความปลอดภัย**

ถ้าประเมินแล้ว → "✅ ประเมินผู้ว่าจ้างแล้ว" + คะแนน

---

## teacher

### หน้าหลัก: `/teacher/dashboard`

อาจารย์ — ประเมินผลงาน นศ.

### หน้าที่ใช้บ่อย

| หน้า | ทำอะไร |
|---|---|
| `/teacher/dashboard` | สรุปงานรอประเมิน |
| `/teacher/evaluation` | ประเมินงานที่ส่งมา (SUBMITTED+) |
| `/teacher/students` | รายชื่อ นศ. + ผลงานสะสม |
| `/teacher/pending` | คำขออื่นๆ ที่ต้องดำเนินการ |

### ประเมินผลงาน

1. ไป `/teacher/evaluation` → เห็นรายการงานที่ส่งมา
2. คลิกงาน → ดูรายละเอียด + รูปงานเสร็จ
3. ให้คะแนน 4 หัวข้อ rubric (1-4 score)
4. comment + recommend promotion (ถ้ามี)
5. คะแนนนี้ส่งผลต่อ **SkillCredit** ของ นศ.

---

## donor

### หน้าหลัก: `/donor/dashboard`

ผู้บริจาค — สนับสนุนกองทุน + ดู impact

### หน้าที่ใช้บ่อย

| หน้า | ทำอะไร |
|---|---|
| `/donor/dashboard` | สรุปการบริจาค + ลิงก์ |
| `/donor/donate` | ฟอร์มบริจาค |
| `/donor/impact` | ดู impact / outcomes |
| `/donor/audit` | ตรวจสอบ on-chain audit trail |

---

## TRPB Wallet

ทุก role ดูยอด TRPB ที่ `/wallet` (universal page)

### สิ่งที่เห็น

```
┌──────────────────────────────────────────┐
│ ยอดคงเหลือ                                │
│ 5,000 TRPB                                │
│ + 500 TRPB กันใน Escrow                   │
└──────────────────────────────────────────┘

📜 ประวัติการเคลื่อนไหว
↓ [ปล่อย Escrow]   +500 TRPB ... 28/4/2569
↑ [โอน]           −5000 TRPB ... 25/4/2569
   เหตุผล: โควต้าทดสอบ
```

### Badge ที่ header

ทุกหน้ามี **TRPB badge** สีเหลืองที่มุมขวาบน → คลิกไป `/wallet`
ถ้ามี hold balance → แสดงเพิ่มในวงเล็บ `(+500)`

---

## QR Quick Login

นศ. มีตัวเลือก login ผ่าน QR + 6-digit PIN (ไม่ต้องจำ password)

### Flow

1. Admin สร้าง QR token ให้ นศ. (ใน admin/users)
2. นศ. scan QR ผ่านมือถือ → ระบบขอ PIN
3. กรอก PIN ที่ตั้งไว้ → login session 7 วัน

### ปัญหา iOS

หากกล้อง iOS เปิดมาแล้วหน้าจอดำ:
- ตรวจ Settings → Safari → Camera → Allow
- ใช้ **Safari** (อย่าใช้ in-app browser ของ Line/Facebook)
- Pull-down refresh หากเปิดครั้งแรกแล้ว 'this page couldn't load'

ระบบ scanner ใหม่:
- หน้า `/j/[token]` → spinner "กำลังเปิดหน้างาน..." → auto redirect ตาม role
- ถ้า error → แสดง "ลองใหม่" button

---

## ทรัพยากรเพิ่มเติม

- [docs/MIGRATIONS.md](MIGRATIONS.md) — SQL ที่ต้องรันถ้าทำ DB ใหม่
- [docs/architecture.md](architecture.md) — ภาพรวมระบบ + state machines
- [docs/API_REFERENCE.md](API_REFERENCE.md) — รายการ API endpoints
- [docs/deployment.md](deployment.md) — Setup deploy ใน Vercel + Supabase
- [docs/SECURITY.md](SECURITY.md) — RLS, secrets, threat model
