# SkillChain RMUTL

ระบบจับคู่งาน + รับรองทักษะ + ระบบเครดิต on-chain สำหรับนักศึกษาช่าง มทร.ล้านนา
ภายใต้โครงการ **"ใต้ร่มพระบารมี"** — เชื่อม **ผู้ว่าจ้าง / นักศึกษา / อาจารย์ / ผู้บริจาค** ไว้ในระบบเดียว
พร้อมบันทึกผลการประเมินและการจ่ายเงินผ่าน **TRON Blockchain (Nile Testnet)**

> **หมายเหตุ:** โปรเจกต์นี้ใช้ Next.js 16 ที่มี breaking changes —
> ก่อนแก้โค้ดให้ดู `AGENTS.md` และอ่าน guide ใน `node_modules/next/dist/docs/`

---

## สารบัญ

- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [User Roles](#user-roles)
- [Job Lifecycle](#job-lifecycle)
- [Credential System](#credential-system)
- [Setup from Scratch](#setup-from-scratch-ตั้งค่าตั้งแต่ต้น)
- [Test Accounts](#test-accounts)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Smart Contracts](#smart-contracts)
- [Documentation](#documentation)

---

## Features

| Feature | รายละเอียด |
|---------|------------|
| **Auth & 8 Roles** | Supabase Auth — student, employer, teacher, donor, project_staff, rmutl_staff, admin, superadmin |
| **Job Board** | ผู้ว่าจ้างโพสต์งาน พร้อมรูปเครื่อง/ลักษณะงาน 2-4 รูป, นศ. ส่งคำขอรับงาน |
| **Job Lifecycle** | OPEN → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED พร้อม Dual Confirmation |
| **TRPB Token** | TRC-20 token บน TRON Nile Testnet (1 TRPB = 1 THB) |
| **Escrow Payment** | Smart contract ถือเงินระหว่างทำงาน → ปล่อยอัตโนมัติเมื่องานเสร็จ |
| **Employer Quota** | ผู้ว่าจ้างได้โควต้างานจ้าง N ครั้ง, คณะทำงานจ่ายแทนจากกองทุน |
| **Auto Wallet** | สร้าง TRON wallet อัตโนมัติเมื่อ admin อนุมัติผู้ใช้ |
| **Credential 5 Levels** | Registered → Project Certified → Teacher Certified → National → Master Tech |
| **3-Phase Evaluation** | ก่อนทำงาน / ระหว่างทำงาน / หลังงานเสร็จ (อาจารย์ + ผู้ว่าจ้าง + นศ.) |
| **Image Upload** | ผู้ว่าจ้างอัปรูปงาน, นศ. อัปรูประหว่างทำ + ส่งงาน, อัปรูปโปรไฟล์ |
| **NFT Credentials** | บันทึกผลรับรองและประวัติ on-chain |
| **Donation Fund** | กองทุนบริจาค restricted/unrestricted |
| **Chat** | แชทในงานระหว่างผู้ว่าจ้างกับนศ. |
| **Notifications** | ระบบแจ้งเตือน real-time |
| **Dispute Resolution** | ระบบข้อพิพาท + staff ตัดสิน |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| State | Zustand, TanStack Query |
| Backend | Next.js Route Handlers |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7 |
| Auth | Supabase SSR (cookie-based) |
| Blockchain | TRON Nile Testnet, TronWeb 6, Solidity |
| Token | TRPB Coin (TRC-20, decimals: 6) |
| Storage | Supabase Storage (bucket: `job-images`) |
| Validation | Zod 4 |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Student  │  │ Employer  │  │ Teacher  │  │ Admin/Staff   │  │
│  │ Portal   │  │ Portal    │  │ Portal   │  │ Portal        │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────┬────────┘  │
└───────┼──────────────┼─────────────┼────────────────┼───────────┘
        │              │             │                │
        ▼              ▼             ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js 16 App Router                         │
│  ┌──────────────────┐  ┌────────────────────────────────────┐   │
│  │ Server Components │  │ API Routes (/api/*)                │   │
│  │ (SSR Pages)       │  │ - /api/auth/* (login/register)     │   │
│  └──────────────────┘  │ - /api/jobs/* (CRUD + lifecycle)    │   │
│                         │ - /api/users/*/approve (+ wallet)  │   │
│                         │ - /api/evaluations, /api/reviews   │   │
│                         │ - /api/disputes, /api/donations    │   │
│                         └──────────┬─────────────────────────┘   │
└────────────────────────────────────┼─────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                  ▼
         ┌──────────────────┐              ┌──────────────────┐
         │   Supabase       │              │   TRON Nile      │
         │ ┌──────────────┐ │              │   Testnet        │
         │ │ PostgreSQL   │ │              │ ┌──────────────┐ │
         │ │ (users, jobs │ │              │ │ TRPBToken    │ │
         │ │  reviews...) │ │              │ │ (TRC-20)     │ │
         │ ├──────────────┤ │              │ ├──────────────┤ │
         │ │ Auth (SSR)   │ │              │ │ JobEscrow    │ │
         │ ├──────────────┤ │              │ │ (escrow +    │ │
         │ │ Storage      │ │              │ │  auto-split) │ │
         │ │ (job-images) │ │              │ └──────────────┘ │
         │ └──────────────┘ │              └──────────────────┘
         └──────────────────┘
```

---

## User Roles

| Role | Thai | สิทธิ์หลัก |
|------|------|-----------|
| `student` | นักศึกษา | ดูงาน, ส่งคำขอรับงาน, ทำงาน, ส่งงาน, อัปรูป, ประเมินผู้จ้าง |
| `employer` | ผู้ว่าจ้าง | โพสต์งาน (ใช้โควต้า), อัปรูปงาน, ยืนยันงานเสร็จ, ประเมิน นศ. |
| `teacher` | อาจารย์ | ประเมิน นศ. (pre/post work), รับรอง credential, ดูผลนักศึกษา |
| `project_staff` | คณะทำงานใต้ร่มฯ | อนุมัติคำขอรับงาน, กำกับงาน, จ่ายค่าจ้าง on-chain, จัดการ credential |
| `rmutl_staff` | คณะทำงาน มทร. | คล้าย project_staff, ยืนยัน นศ. |
| `donor` | ผู้บริจาค | บริจาคเข้ากองทุน, ดูผลกระทบ, ตรวจสอบการใช้จ่าย |
| `admin` | แอดมิน | จัดการผู้ใช้, ยืนยัน/ระงับบัญชี, ตั้งค่าระบบ, ดู dashboard |
| `superadmin` | Super Admin | สิทธิ์ทั้งหมด |

### การอนุมัติผู้ใช้

```
ผู้ใช้สมัคร → status: PENDING → Admin/Staff กด "ยืนยัน"
                                       ↓
                              API สร้าง TRON Wallet อัตโนมัติ
                                       ↓
                              status: APPROVED + wallet_address ถูกบันทึก
                                       ↓
                              ส่ง notification แจ้ง นศ.
```

---

## Job Lifecycle

```
 ผู้ว่าจ้าง                คณะทำงาน              นักศึกษา
    │                         │                      │
    │  1. สร้างงาน            │                      │
    │  + อัปรูปเครื่อง 2-4 รูป │                      │
    ▼                         │                      │
 ┌──────┐                     │                      │
 │ OPEN │ ◄──────────────────────────────── 2. ส่งคำขอรับงาน
 └──┬───┘                     │                      │
    │                    3. อนุมัติคำขอ               │
    ▼                    (assign นศ.)                 │
 ┌──────────┐                 │                      │
 │ ASSIGNED │                 │                      │
 └──┬───────┘                 │                      │
    │          4. เสนอ/ยืนยันวันทำงาน (ทั้ง 2 ฝ่าย)    │
    ▼                         │                      │
 ┌─────────────┐              │                      │
 │ IN_PROGRESS │ ◄────────────────────── 5. อัปรูประหว่างทำ
 └──┬──────────┘              │                      │
    │                         │          6. ส่งงาน + รูปงานเสร็จ
    ▼                         │                      │
 ┌───────────┐                │                      │
 │ SUBMITTED │                │                      │
 └──┬────────┘                │                      │
    │              7a. Staff ยืนยัน    7b. ผู้จ้างยืนยัน
    │              (Dual Confirmation)                │
    ▼                         │                      │
 ┌───────────┐                │                      │
 │ COMPLETED │                │                      │
 └──┬────────┘                │                      │
    │              8. จ่ายค่าจ้าง on-chain             │
    │              (TRPB → student wallet)            │
    │                         │                      │
    │              9. ประเมิน (3 ระยะ)                 │
    ▼                         ▼                      ▼
```

### การจ่ายค่าจ้าง (Escrow)

```
กองทุน (1,000,000 TRPB)
         │
         ▼ deployer wallet จ่ายแทนผู้ว่าจ้าง
  ┌─────────────────────┐
  │   JobEscrow.release │
  │                     │
  │   ├── 85% → นศ.    │  (90% ถ้าไม่มี mentor)
  │   ├── 5%  → กองทุน │
  │   ├── 5%  → mentor  │  (0% ถ้าไม่มี)
  │   └── 5%  → staff   │
  └─────────────────────┘
```

---

## Credential System

| Level | ชื่อ | ผู้รับรอง | NFT |
|-------|------|----------|-----|
| LEVEL_1 | ลงทะเบียน | ระบบอัตโนมัติ | - |
| LEVEL_2 | ผ่านฝึกอบรมโครงการ | คณะทำงาน | Bronze |
| LEVEL_3 | อาจารย์รับรอง | อาจารย์ มทร. | Silver |
| LEVEL_4 | สถาบันระดับชาติรับรอง | กรมพัฒนาฝีมือ/สคช. | Gold |
| LEVEL_5 | ช่างชำนาญการ | Master Tech Panel | Diamond |

### สิทธิ์ตาม Credential Level

| ประเภทงาน | ต้องมี Level ขั้นต่ำ |
|-----------|---------------------|
| TRAINING | LEVEL_2 |
| VOLUNTEER | LEVEL_2 |
| PAID | LEVEL_3 |
| EXEMPTED | LEVEL_3 |

---

## Setup from Scratch (ตั้งค่าตั้งแต่ต้น)

### ขั้นตอนที่ 1: Prerequisites

```bash
# ต้องมี
- Node.js 20+
- npm หรือ pnpm
- Git
- บัญชี Supabase (https://supabase.com)
```

### ขั้นตอนที่ 2: Clone & Install

```bash
git clone https://github.com/worrajak/skillchain_rmutl.git
cd skillchain_rmutl/skillchain-web3
npm install
```

### ขั้นตอนที่ 3: สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com) → Create New Project
2. เลือก Region: **Singapore** (ap-southeast-1)
3. ตั้ง Database Password (จดไว้)
4. รอสร้างเสร็จ → จดค่าเหล่านี้จาก Settings:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Connection String (Pooler)** → `DATABASE_URL`
   - **Connection String (Direct)** → `DIRECT_URL`

### ขั้นตอนที่ 4: ตั้งค่า Environment

```bash
cp .env.example .env.local
```

แก้ไข `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Database (จาก Supabase Dashboard > Settings > Database)
DATABASE_URL=postgresql://postgres.xxxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

# Wallet Encryption Key (สำหรับเข้ารหัส private key ของ wallet ที่สร้างอัตโนมัติ)
WALLET_ENCRYPTION_KEY=YourSecretKeyHere32Characters!!

# TRON Nile Testnet
TRON_DEPLOYER_PRIVATE_KEY=   # ← ใส่หลัง Step 6
NEXT_PUBLIC_TRON_FULL_HOST=https://nile.trongrid.io
NEXT_PUBLIC_TRON_NETWORK=nile

# Contract Addresses (ใส่หลัง deploy)
NEXT_PUBLIC_TRPB_TOKEN_ADDRESS=
NEXT_PUBLIC_JOB_ESCROW_ADDRESS=
```

### ขั้นตอนที่ 5: สร้างฐานข้อมูล

```bash
# 5a. Deploy Prisma migrations
npx prisma migrate deploy

# 5b. รัน manual migrations ใน Supabase SQL Editor ตามลำดับ:
#     1. prisma/migrations/manual_schema_drift_fix.sql
#     2. prisma/migrations/manual_schema_drift_fix_v2.sql
#     3. prisma/migrations/manual_add_job_assignment_requests.sql
#     4. prisma/migrations/manual_job_images_and_quota.sql
#     5. prisma/migrations/manual_avatar_url.sql

# 5c. Seed ข้อมูลเริ่มต้น (test accounts + sample data)
npm run db:seed
```

### ขั้นตอนที่ 6: สร้าง Supabase Storage Bucket

1. ไปที่ Supabase Dashboard → Storage
2. สร้าง bucket ชื่อ **`job-images`**
3. ตั้งเป็น **Public** (allow public read)
4. เพิ่ม policies:
   - **SELECT**: Allow all (public read)
   - **INSERT**: Allow authenticated users
   - **DELETE**: Allow authenticated users (owner check)

### ขั้นตอนที่ 7: ตั้งค่า TRON Blockchain

```bash
# 7a. สร้าง deployer wallet
node scripts/create-wallet.mjs

# Output:
#   Address:     TXxxxx...
#   Private Key: abcdef...

# 7b. ใส่ private key ใน .env.local
# TRON_DEPLOYER_PRIVATE_KEY=abcdef...

# 7c. ขอ TRX ฟรี (ค่า gas) จาก Nile Faucet
# เปิด https://nile.tronscan.org/#/wallet/new
# วาง Address → กด Request 2000 TRX

# 7d. Deploy smart contracts
node scripts/deploy-nile.mjs

# Script จะ:
# - Compile TRPBToken.sol + JobEscrow.sol
# - Deploy ไปยัง Nile Testnet
# - บันทึก ABI ไปที่ src/lib/tron/abi/
# - อัปเดต .env.local ด้วย contract addresses
```

### ขั้นตอนที่ 8: Mint TRPB Token เริ่มต้น

```bash
# ใช้ TronScan หรือ script เพื่อ mint TRPB ให้ deployer wallet
# ตัวอย่าง: mint 1,000,000 TRPB สำหรับกองทุนกลาง
# (ดู docs/tron-setup.md สำหรับรายละเอียด)
```

### ขั้นตอนที่ 9: เปิด Dev Server

```bash
npm run dev
# เปิด http://localhost:3000
```

### ขั้นตอนที่ 10: ทดสอบ

1. Login ด้วย admin@rmutl.ac.th / Admin1234!
2. ไปที่ Admin → Approvals → ยืนยันผู้ใช้ (สร้าง wallet อัตโนมัติ)
3. Login ด้วย employer@test.com → สร้างงาน + อัปรูป
4. Login ด้วย student@test.com → ส่งคำขอรับงาน
5. Login ด้วย staff@test.com → อนุมัติคำขอ
6. ทำตาม Job Lifecycle จนเสร็จสมบูรณ์

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rmutl.ac.th | Admin1234! |
| Student | student@test.com | Test1234! |
| Employer | employer@test.com | Test1234! |
| Teacher | teacher@test.com | Test1234! |
| Project Staff | staff@test.com | Test1234! |
| RMUTL Staff | rmutl@test.com | Test1234! |
| Donor | donor@test.com | Test1234! |

> หมายเหตุ: บัญชีเหล่านี้ถูกสร้างจาก `npm run db:seed` — ใช้สำหรับทดสอบเท่านั้น

---

## Project Structure

```
skillchain-web3/
├── contracts/                    # Smart Contracts (Solidity)
│   ├── TRPBToken.sol             #   TRC-20 token (TRPB Coin)
│   └── JobEscrow.sol             #   Escrow + auto-split payment
│
├── prisma/
│   ├── schema.prisma             # Prisma schema
│   ├── seed.ts                   # Database seed (test accounts)
│   └── migrations/
│       ├── manual_schema_drift_fix.sql
│       ├── manual_schema_drift_fix_v2.sql
│       ├── manual_add_job_assignment_requests.sql
│       ├── manual_job_images_and_quota.sql
│       └── manual_avatar_url.sql
│
├── scripts/
│   ├── create-wallet.mjs         # สร้าง TRON wallet
│   └── deploy-nile.mjs           # Deploy contracts to Nile
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── student/              # Student Portal
│   │   │   ├── dashboard/page.tsx    # หน้าหลัก + งานที่รับ
│   │   │   ├── profile/page.tsx      # โปรไฟล์ + avatar + credential
│   │   │   ├── jobs/page.tsx         # Job Board (ส่งคำขอรับงาน)
│   │   │   └── wallet/page.tsx       # TRPB balance
│   │   │
│   │   ├── employer/             # Employer Portal
│   │   │   ├── dashboard/page.tsx    # หน้าหลัก + สรุปงาน
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx          # รายการงาน
│   │   │   │   ├── new/page.tsx      # สร้างงาน + อัปรูป
│   │   │   │   └── [id]/page.tsx     # รายละเอียดงาน + ยืนยัน
│   │   │   └── students/page.tsx     # ดูนักศึกษา + avatar + rating
│   │   │
│   │   ├── teacher/              # Teacher Portal
│   │   │   ├── evaluation/page.tsx   # ประเมินนักศึกษา
│   │   │   ├── students/page.tsx     # รายชื่อนักศึกษา
│   │   │   └── pending/page.tsx      # credential รอรับรอง
│   │   │
│   │   ├── project-staff/        # Project Staff Portal
│   │   │   ├── dashboard/page.tsx    # หน้าหลัก
│   │   │   ├── approvals/page.tsx    # อนุมัติคำขอรับงาน
│   │   │   ├── active-jobs/page.tsx  # งานที่กำกับ + จ่ายเงิน
│   │   │   ├── disputes/page.tsx     # ข้อพิพาท
│   │   │   └── cancellations/page.tsx
│   │   │
│   │   ├── admin/                # Admin Portal
│   │   │   ├── dashboard/page.tsx    # Dashboard สรุปรวม
│   │   │   ├── approvals/page.tsx    # ยืนยันผู้ใช้ (+ auto wallet)
│   │   │   ├── users/page.tsx        # จัดการผู้ใช้ + โควต้า + สิทธิ์
│   │   │   ├── jobs/page.tsx         # จัดการงานทั้งหมด
│   │   │   ├── credentials/page.tsx  # จัดการ credential
│   │   │   ├── reviews/page.tsx      # ดูผลประเมิน
│   │   │   └── reports/page.tsx      # รายงาน
│   │   │
│   │   ├── donor/                # Donor Portal
│   │   │   ├── donate/page.tsx       # บริจาค
│   │   │   ├── audit/page.tsx        # ตรวจสอบ
│   │   │   └── impact/page.tsx       # ผลกระทบ
│   │   │
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/             #   login, register, logout
│   │   │   ├── users/[id]/approve/   # ยืนยันผู้ใช้ + สร้าง wallet
│   │   │   ├── jobs/[id]/
│   │   │   │   ├── route.ts          # GET job detail
│   │   │   │   ├── approve/          # อนุมัติคำขอรับงาน
│   │   │   │   ├── schedule/         # เสนอ/ยืนยันวันทำงาน
│   │   │   │   ├── submit/           # นศ. ส่งงาน
│   │   │   │   ├── confirm-completion/ # ยืนยันงานเสร็จ
│   │   │   │   ├── release-escrow/   # จ่ายค่าจ้าง on-chain
│   │   │   │   └── cancel/           # ยกเลิกงาน
│   │   │   ├── employers/[id]/quota/ # โควต้าผู้ว่าจ้าง
│   │   │   ├── evaluations/          # ประเมิน 3 ระยะ
│   │   │   ├── reviews/              # review ซึ่งกันและกัน
│   │   │   ├── disputes/             # ข้อพิพาท
│   │   │   ├── donations/            # บริจาค
│   │   │   ├── notifications/        # แจ้งเตือน
│   │   │   └── chat/[jobId]/         # แชทในงาน
│   │   │
│   │   └── page.tsx              # Homepage
│   │
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── avatar-upload.tsx     # AvatarUpload + UserAvatar
│   │   ├── image-upload.tsx      # Upload รูปงาน/progress/completion
│   │   ├── image-gallery.tsx     # แสดงรูป + lightbox
│   │   ├── escrow-payment-card.tsx # UI จ่ายเงิน on-chain
│   │   ├── navbar.tsx            # Navigation bar
│   │   ├── trpb-balance.tsx      # แสดงยอด TRPB
│   │   ├── staff-supervisor-badge.tsx
│   │   ├── chat/chat-room.tsx
│   │   ├── notifications/notification-bell.tsx
│   │   └── reviews/              # ฟอร์มประเมินต่างๆ
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser Supabase client
│   │   │   ├── server.ts         # Server Supabase client (SSR)
│   │   │   └── middleware.ts     # Auth middleware
│   │   ├── tron/
│   │   │   ├── client.ts         # TronWeb helpers + contract calls
│   │   │   └── abi/              # Contract ABIs (auto-generated)
│   │   ├── crypto.ts             # AES-256-GCM encrypt/decrypt (wallet keys)
│   │   ├── credential.ts         # Credential logic
│   │   └── utils.ts              # Utility functions
│   │
│   └── types/
│       └── database.ts           # TypeScript types + evaluation criteria
│
├── docs/                         # Documentation
│   ├── vision.md                 # วิสัยทัศน์
│   ├── architecture.md           # สถาปัตยกรรม
│   ├── job-lifecycle.md          # วงจรชีวิตงาน
│   ├── roles.md                  # สิทธิ์ role
│   ├── credentials.md            # ระบบ credential
│   ├── smart-contracts.md        # Smart contracts
│   ├── database.md               # Database schema
│   ├── api.md                    # API reference
│   ├── setup-supabase.md         # ตั้งค่า Supabase
│   ├── tron-setup.md             # ตั้งค่า TRON
│   ├── deployment.md             # Deploy production
│   └── proposals/                # ข้อเสนอ feature อนาคต
│
├── .env.example                  # ตัวอย่าง environment variables
├── AGENTS.md                     # Rules for AI agents
├── TEST_PLAN.md                  # แผนทดสอบ + test accounts
└── package.json
```

---

## API Reference

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | สมัครสมาชิก |
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| POST | `/api/auth/logout` | ออกจากระบบ |

### User Management
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/users/[id]/approve` | ยืนยันผู้ใช้ + สร้าง TRON wallet |
| GET/PATCH | `/api/employers/[id]/quota` | ดู/ตั้งค่าโควต้าผู้ว่าจ้าง |

### Job Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs/[id]` | รายละเอียดงาน |
| POST | `/api/jobs/[id]/approve` | Staff อนุมัติคำขอรับงาน |
| POST/PATCH | `/api/jobs/[id]/schedule` | เสนอ/ยืนยันวันทำงาน |
| POST | `/api/jobs/[id]/submit` | นศ. ส่งงาน |
| POST | `/api/jobs/[id]/confirm-completion` | ยืนยันงานเสร็จ (dual confirm) |
| POST | `/api/jobs/[id]/release-escrow` | จ่ายค่าจ้าง on-chain |
| POST | `/api/jobs/[id]/cancel` | ยกเลิกงาน |

### Evaluation & Reviews
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/evaluations` | อาจารย์ประเมิน |
| POST | `/api/reviews` | ผู้ว่าจ้าง/นศ./mentor ประเมิน |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/notifications` | แจ้งเตือน |
| GET/POST | `/api/disputes` | ข้อพิพาท |
| GET/POST | `/api/chat/[jobId]/messages` | แชทในงาน |

---

## Smart Contracts

### TRPBToken (TRC-20)

```
Symbol: TRPB | Decimals: 6 | Rate: 1 TRPB = 1 THB
```

| Function | Description |
|----------|-------------|
| `transfer(to, value)` | โอน TRPB |
| `approve(spender, value)` | อนุมัติ allowance |
| `mint(to, value)` | สร้าง token ใหม่ (owner only) |
| `burn(value)` | ทำลาย token |
| `balanceOf(address)` | ดูยอด |

### JobEscrow

| Function | Description |
|----------|-------------|
| `createEscrow(jobId, student, mentor, amount)` | ล็อคเงินค่าจ้าง |
| `release(jobId)` | ปล่อยเงิน → แบ่งอัตโนมัติ |
| `refund(jobId)` | คืนเงินให้ผู้จ้าง (ยกเลิกงาน) |
| `getEscrow(jobId)` | ดูข้อมูล escrow |

**Fee Structure:**

| ส่วนแบ่ง | มี Mentor | ไม่มี Mentor |
|----------|----------|-------------|
| นักศึกษา | 85% | 90% |
| กองทุนกลาง | 5% | 5% |
| Mentor | 5% | 0% |
| คณะทำงาน | 5% | 5% |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | เปิด dev server (localhost:3000) |
| `npm run build` | Build production |
| `npm run start` | รัน production build |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed ข้อมูลตัวอย่าง |
| `npm run db:reset` | Reset DB (ลบทุกอย่าง) |
| `npm run db:studio` | เปิด Prisma Studio |
| `node scripts/create-wallet.mjs` | สร้าง TRON wallet |
| `node scripts/deploy-nile.mjs` | Deploy contracts to Nile |

---

## Database Schema (หลัก)

### ตาราง

| Table | Description |
|-------|-------------|
| `users` | ผู้ใช้ทั้งหมด (8 roles) + wallet_address + avatar_url |
| `jobs` | งานทั้งหมด + status lifecycle + escrow_tx |
| `job_images` | รูปภาพงาน (job/progress/completion) |
| `job_assignment_requests` | คำขอรับงานจาก นศ. |
| `evaluations` | ผลประเมินจากอาจารย์ (4 dimensions) |
| `employer_reviews` | ผู้ว่าจ้างประเมิน นศ. |
| `student_reviews` | นศ. ประเมินผู้ว่าจ้าง |
| `mentor_reviews` | mentor ประเมิน trainee |
| `student_credentials` | credential 5 levels + NFT hash |
| `student_tier_records` | tier: trainee/apprentice/certified |
| `student_qualifications` | badge level + stats |
| `donation_funds` | กองทุนบริจาค |
| `behavior_logs` | พฤติกรรม + penalty |
| `approval_logs` | log การอนุมัติ |
| `notifications` | แจ้งเตือน |

### Views

| View | Description |
|------|-------------|
| `student_rating_summary` | คะแนนรวม นศ. (teacher + employer + mentor) + avatar_url |

---

## Documentation

| Document | Link |
|----------|------|
| วิสัยทัศน์ | [docs/vision.md](docs/vision.md) |
| สถาปัตยกรรม | [docs/architecture.md](docs/architecture.md) |
| Smart Contracts | [docs/smart-contracts.md](docs/smart-contracts.md) |
| วงจรชีวิตงาน | [docs/job-lifecycle.md](docs/job-lifecycle.md) |
| Database Schema | [docs/database.md](docs/database.md) |
| สิทธิ์ Role | [docs/roles.md](docs/roles.md) |
| Credential System | [docs/credentials.md](docs/credentials.md) |
| API Routes | [docs/api.md](docs/api.md) |
| ตั้งค่า Supabase | [docs/setup-supabase.md](docs/setup-supabase.md) |
| ตั้งค่า TRON | [docs/tron-setup.md](docs/tron-setup.md) |
| Deploy Production | [docs/deployment.md](docs/deployment.md) |
| แผนทดสอบ | [TEST_PLAN.md](TEST_PLAN.md) |

### Proposals (อนาคต)

| Proposal | Description |
|----------|-------------|
| [training-program](docs/proposals/training-program.md) | หลักสูตรอบรมระยะสั้น |
| [skill-taxonomy](docs/proposals/skill-taxonomy.md) | ต้นไม้ทักษะ (รากฐานทุก proposal) |
| [talent-directory](docs/proposals/talent-directory.md) | Public profile + portfolio |
| [learning-path](docs/proposals/learning-path.md) | Career ladder + progress |
| [verifiable-credential](docs/proposals/verifiable-credential.md) | W3C VC + DID |
| [community-mentorship](docs/proposals/community-mentorship.md) | Peer endorsement |

---

## Security

- Private keys เข้ารหัสด้วย AES-256-GCM ก่อนเก็บใน DB
- Supabase RLS policies ทุกตาราง
- Role-based access control ทุก API route
- WALLET_ENCRYPTION_KEY แยกจาก codebase
- ไม่เก็บ credentials ใน repository

หากพบช่องโหว่ ดู [SECURITY.md](SECURITY.md) — อย่าเปิดเป็น public issue

---

## License

[MIT](LICENSE) — ภายใต้โครงการวิจัย มทร.ล้านนา (โครงการใต้ร่มพระบารมี)
