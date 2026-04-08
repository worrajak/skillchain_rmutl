# Architecture

## ภาพรวม

SkillChain เป็น web app ที่เชื่อมระบบจับคู่งานเข้ากับ on-chain credential
ใช้ Next.js App Router เป็นทั้ง frontend และ backend (API routes)

```
┌──────────────┐    ┌──────────────────┐    ┌────────────────┐
│  Browser /   │ ─▶ │  Next.js (App    │ ─▶ │  Supabase      │
│  TronLink    │    │  Router + RSC)   │    │  (Postgres +   │
│              │    │                  │    │   Auth)        │
└──────┬───────┘    └────────┬─────────┘    └────────────────┘
       │                     │
       │                     ▼
       │            ┌──────────────────┐
       └──────────▶ │  TRON Nile       │
                    │  TRPBToken +     │
                    │  JobEscrow       │
                    └──────────────────┘
```

## Layers

### 1. Presentation (`src/app`)
- จัดตาม role: `student/`, `employer/`, `teacher/`, `donor/`, `project-staff/`, `admin/`
- ใช้ React Server Components เป็นหลัก, client components เฉพาะที่ต้องการ interactivity / wallet

### 2. API (`src/app/api`)
- Route handlers สำหรับ mutation และ data fetching ฝั่ง client
- ใช้ Zod validate input ทุก endpoint
- เรียก Prisma + Supabase client

### 3. Data (`prisma/`)
- Postgres ผ่าน Prisma 7
- ดูสรุป schema ใน [database.md](database.md)

### 4. Blockchain (`src/lib/tron/*`, `contracts/`)
- TronWeb 6 เป็น client
- TRPBToken (TRC-20) สำหรับเงินรางวัล
- JobEscrow ถือเงินระหว่างงานและปล่อยตามสถานะ

### 5. Auth
- Supabase SSR cookie-based
- `middleware.ts` กั้น route ตาม role

## Data Flow ตัวอย่าง — สร้างงานและจ่ายเงิน

1. Employer สร้างงาน → API → Prisma `Job` (status `OPEN`)
2. Employer lock เงินใน Escrow → tx_hash บันทึกใน `Job.escrow_tx`
3. นักศึกษา apply → staff/teacher assign → status `ASSIGNED` → `CONFIRMED`
4. นักศึกษาส่งงาน → status `SUBMITTED`
5. Teacher / employer ประเมิน → `Evaluation`, `EmployerReview`
6. ระบบเรียก `JobEscrow.release()` → status `COMPLETED`
7. NFT credential ออกให้ (ถ้า config ไว้) → tx_hash เก็บใน `StudentCredential.nft_tx_hash`

ดูรายละเอียดสถานะใน [job-lifecycle.md](job-lifecycle.md)
