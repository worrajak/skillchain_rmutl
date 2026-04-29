# SkillChain RMUTL

> ระบบจับคู่งาน + รับรองทักษะ + เครดิต TRPB สำหรับนักศึกษาช่าง มทร.ล้านนา
> ภายใต้โครงการ **"ใต้ร่มพระบารมี"**
> เชื่อมโยง **ผู้ว่าจ้าง / นักศึกษา / คณะทำงานใต้ร่มฯ / อาจารย์ / ผู้บริจาค** ไว้ในระบบเดียว

[![Tech: Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Database: Supabase](https://img.shields.io/badge/Supabase-Postgres-green)](https://supabase.com)
[![Blockchain: TRON Nile](https://img.shields.io/badge/TRON-Nile_Testnet-red)](https://nile.tronscan.org)

---

## ⚠️ Important: TRON Nile Testnet Only

ระบบนี้ใช้ **TRON Nile testnet** เท่านั้น — TRPB token ที่หมุนเวียนในระบบเป็น **เหรียญทดสอบ ไม่สามารถแลกเป็นเงินจริงได้**
จุดประสงค์: ทดสอบ workflow + บันทึก audit trail แบบ blockchain ก่อนนำขึ้น mainnet

---

## Quickstart

```bash
git clone https://github.com/worrajak/skillchain_rmutl.git
cd skillchain_rmutl/skillchain-web3
npm install
cp .env.example .env.local
# แก้ค่า .env.local — ดู docs/deployment.md
npm run dev          # http://localhost:3000
```

**ก่อนรันครั้งแรก** ต้องเตรียม Supabase + รัน SQL migrations หลายตัว
ดู [docs/MIGRATIONS.md](docs/MIGRATIONS.md) สำหรับลำดับ + verify

---

## Architecture สั้นๆ

```
┌────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 16)              │
│  /admin · /project-staff · /employer · /student        │
│  /teacher · /donor · /wallet · /j/[token]              │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│              API Routes (/app/api/)                    │
│  /trpb/* (off-chain ledger)  /jobs/* (lifecycle)       │
│  /reviews/* (eval_phase)     /gov/* (paperwork)        │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│  Supabase (Postgres + Auth + Storage + RLS)           │
│  - skc_* tables (jobs, users, balances, reviews...)   │
│  - SQL functions: fn_trpb_transfer/escrow_*           │
│  - Triggers: gov-workflow + balance auto-init         │
└────────────────────┬───────────────────────────────────┘
                     │ (mirror only — optional)
┌────────────────────▼───────────────────────────────────┐
│              TRON Nile Testnet                         │
│  TRPB Token: TAj5Fy9GHSG4h6FuyHt9BLEDyFmqqPyFBt        │
│  Job Escrow: TPDJ6DzbYGeEkjZyp7VpC95cLizPXEgWT5        │
│  Treasury:   TU7VbEyrdZMmfMAqsNUmjmcG4CMBLtK7qj        │
└────────────────────────────────────────────────────────┘
```

ดูภาพ + flow เต็มที่ [docs/architecture.md](docs/architecture.md)

---

## TRPB — Off-chain Ledger

ระบบเหรียญ **TRPB** ใช้ off-chain ledger เป็นหลัก:

```
SYSTEM Pool (1,000,000 TRPB)
    ↓ admin mint
Project Staff (โควต้าจาก admin)
    ↓ staff transfer
Employer (เครดิตสำหรับจ้างงาน)
    ↓ escrow hold + release
Student (ค่าจ้างเมื่องานเสร็จ)
```

**Distribution flow ที่หน้า:**
- `/admin/trpb` — จ่ายจาก SYSTEM pool
- `/project-staff/trpb` — staff กระจายให้ผู้ว่าจ้าง
- `/wallet` — ทุก role ดู balance + ประวัติ
- `/admin/wallets` — admin ผูก TRON wallet address ให้ user แต่ละคน

ดูรายละเอียด: [docs/USER_GUIDE_TH.md](docs/USER_GUIDE_TH.md)

---

## User Roles

| Role | หน้าหลัก | Key actions |
|---|---|---|
| **superadmin** | `/admin/dashboard` | จัดการระบบทุกอย่าง + override gov gates |
| **admin** | `/admin/dashboard` | จ่าย TRPB จาก pool, ผูก wallet, จัดการผู้ใช้ |
| **project_staff** (ใต้ร่มฯ) | `/project-staff/dashboard` | กระจาย TRPB, อนุมัติงาน, ปล่อย escrow, ออกเอกสารราชการ |
| **rmutl_staff** | `/project-staff/dashboard` | สิทธิ์เดียวกับ project_staff |
| **teacher** | `/teacher/dashboard` | ประเมินงาน นศ., ดูรายชื่อ |
| **employer** | `/employer/dashboard` | สร้างงาน, อัพรูป, ยืนยันรับงาน, ประเมิน นศ. |
| **student** | `/student/dashboard` | รับงาน, อัพรูประหว่างทำ, ส่งมอบงาน, ประเมินผู้จ้าง |
| **donor** | `/donor/dashboard` | บริจาค, ดู impact, audit |

ทุก role login → `/[role]/dashboard` (consistent)

---

## Job Lifecycle

```
PENDING_REVIEW → OPEN → ASSIGNED → CONFIRMED → IN_PROGRESS → SUBMITTED → COMPLETED → IN_WARRANTY (7 วัน) → CLOSED
                                                                   ↓
                                                              (escrow release)
```

ดูภาพละเอียด + ใครทำอะไรในแต่ละ stage: [docs/architecture.md](docs/architecture.md)

---

## Tech Stack

- **Frontend**: Next.js 16 (Turbopack, App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime + RLS)
- **Blockchain**: TRON Nile testnet (TRPB token + Job Escrow contract — currently mirror-only)
- **Auth**: Supabase Auth (email/password) + Quick Session (QR + 6-digit PIN)
- **Notifications**: Telegram bot (@SkillChainRMUTLBot) + in-app
- **Storage**: Supabase Storage (`job-images`, `official-documents` buckets)
- **Document generation**: `docx` (Word docs ภาษาไทย สำหรับเอกสารราชการ)

---

## Documentation

| ไฟล์ | เนื้อหา |
|---|---|
| [docs/USER_GUIDE_TH.md](docs/USER_GUIDE_TH.md) | คู่มือผู้ใช้แต่ละ role (ภาษาไทย) |
| [docs/MIGRATIONS.md](docs/MIGRATIONS.md) | SQL migrations checklist + ลำดับการรัน |
| [docs/architecture.md](docs/architecture.md) | State machines, data flow, schema, RLS |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Endpoint catalog + payloads |
| [docs/deployment.md](docs/deployment.md) | Vercel + Supabase setup ครบขั้นตอน |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, RLS, secrets, threat model |
| [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) | (เก่า) เอกสารเทคนิคเดิม — มี details เพิ่ม |
| [docs/GOVERNMENT_WORKFLOW.md](docs/GOVERNMENT_WORKFLOW.md) | Workflow เอกสารราชการ |

---

## Test Accounts

หลัง setup เริ่มต้น ระบบมีบัญชีทดสอบ:
- `admin@rmutl.ac.th` — superadmin
- `worrajak@rmutl.ac.th` — admin (lead developer)

สำหรับ role อื่น ๆ admin สร้างผ่าน `/admin/users` หรือ user สมัครเอง + admin approve ที่ `/admin/approvals`

---

## License & Disclaimer

- **TRPB Coin**: เหรียญทดสอบบน TRON Nile testnet — **ไม่ใช่เงินจริง**
- **SkillCredit (SC)**: Soul-Bound (non-transferable) — ปรับระดับทักษะเท่านั้น ไม่แลกเงิน
- โครงการนำร่องโดย **มทร.ล้านนา** ภายใต้โครงการ **ใต้ร่มพระบารมี**

---

## Contact

- Lead Developer: worrajak@rmutl.ac.th
- Project: SkillChain RMUTL Pilot Phase
- Repository: https://github.com/worrajak/skillchain_rmutl
