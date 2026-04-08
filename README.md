# SkillChain RMUTL

ระบบจับคู่งาน + รับรองทักษะ + ระบบเครดิต on-chain สำหรับนักศึกษา มทร.ล้านนา
ภายใต้โครงการ "ใต้ร่มพระบารมี" — เชื่อม **ผู้ว่าจ้าง / นักศึกษา / อาจารย์ / ผู้บริจาค** ไว้ในระบบเดียว
พร้อมบันทึกผลการประเมินและการจ่ายเงินผ่าน **TRON (Nile Testnet)**

> **หมายเหตุสำคัญ:** โปรเจกต์นี้ใช้ Next.js เวอร์ชันใหม่ที่มี breaking changes —
> ก่อนแก้โค้ดให้ดู `AGENTS.md` และอ่าน guide ใน `node_modules/next/dist/docs/`

---

## ✨ Features

- 🔐 **Auth & Roles** — Supabase Auth พร้อม role 8 ประเภท (student, employer, teacher, donor, project_staff, rmutl_staff, admin, superadmin)
- 💼 **Job Lifecycle** — เปิดงาน → มอบหมาย → ยืนยัน → ทำงาน → ส่งงาน → ประเมิน → จ่ายเงิน
- 🎓 **Credential 5 Levels** — Registered → Project Certified → Teacher Certified → National Certified → Master Technician
- ⭐ **Multi-source Reviews** — ผู้ว่าจ้าง/นักศึกษา/พี่เลี้ยง ประเมินซึ่งกันและกัน
- 🪙 **TRPB Token + Job Escrow** — สัญญา TRC-20 + Escrow บน TRON Nile Testnet
- 🏅 **NFT Credentials** — บันทึกผลรับรองและประวัติการทำงาน on-chain
- 💰 **Donation Fund** — กองทุนบริจาคแบบ restricted/unrestricted

---

## 🧱 Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, Base UI |
| State | Zustand, TanStack Query |
| Backend | Next.js Route Handlers, Prisma 7 |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase SSR |
| Blockchain | TRON (Nile Testnet), TronWeb 6, Solidity (TRPBToken, JobEscrow) |
| Validation | Zod 4 |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL (หรือใช้ Supabase project)
- TronLink wallet (สำหรับทดสอบ on-chain)

### 2. Install
```bash
git clone https://github.com/worrajak/skillchain_rmutl.git
cd skillchain_rmutl
npm install
```

### 3. Environment
```bash
cp .env.example .env.local
# กรอกค่า Supabase, DATABASE_URL, contract addresses
```
ดูตัวแปรทั้งหมดใน [.env.example](.env.example)

### 4. Database
```bash
npx prisma migrate deploy
npm run db:seed
```

### 5. Dev server
```bash
npm run dev
# http://localhost:3000
```

---

## 📜 Scripts

| Command | ใช้ทำอะไร |
|---|---|
| `npm run dev` | เปิด dev server |
| `npm run build` | build production |
| `npm run start` | รัน production build |
| `npm run lint` | eslint |
| `npm run db:seed` | seed ข้อมูลตัวอย่าง |
| `npm run db:reset` | reset DB (ระวัง — ลบทุกอย่าง) |
| `npm run db:studio` | เปิด Prisma Studio |

---

## 📁 Project Structure

```
skillchain-web3/
├── contracts/            # Solidity (TRPBToken, JobEscrow)
├── prisma/               # schema + migrations + seed
├── public/
├── scripts/              # tmux helpers, agent scripts
├── src/
│   ├── app/              # Next.js App Router (auth, student, employer, teacher, ...)
│   ├── components/       # UI + feature components
│   ├── hooks/
│   ├── lib/              # supabase, prisma, tronweb clients
│   ├── stores/           # zustand stores
│   └── types/
├── docs/                 # 📚 documentation (architecture, contracts, lifecycle, ...)
├── AGENTS.md             # ⚠️ rules for AI agents
├── CONTRIBUTING.md
└── README.md
```

---

## 📚 Documentation

- [docs/architecture.md](docs/architecture.md) — ภาพรวมระบบและการไหลของข้อมูล
- [docs/smart-contracts.md](docs/smart-contracts.md) — TRPB Token + Job Escrow
- [docs/job-lifecycle.md](docs/job-lifecycle.md) — สถานะงานและขั้นตอน
- [docs/database.md](docs/database.md) — สรุป schema หลัก
- [docs/roles.md](docs/roles.md) — สิทธิ์ของแต่ละ role

---

## 🤝 Contributing

อ่าน [CONTRIBUTING.md](CONTRIBUTING.md) ก่อนส่ง PR

## 📄 License

โปรเจกต์ภายใต้โครงการวิจัย มทร.ล้านนา — ติดต่อผู้ดูแลก่อนนำไปใช้
