# Deployment

ขั้นตอน deploy SkillChain RMUTL ขึ้น production

---

## Stack

- **Hosting**: Vercel (auto-deploy จาก GitHub `main` branch)
- **Database**: Supabase Cloud (Postgres + Auth + Storage)
- **Blockchain**: TRON Nile testnet (mirror only)
- **Notifications**: Telegram bot
- **Domain**: TBD (e.g., skillchain.rmutl.ac.th)

---

## Prerequisites

1. **GitHub repo** — `https://github.com/worrajak/skillchain_rmutl`
2. **Vercel account** — เชื่อมกับ GitHub repo
3. **Supabase project** — สร้างใน [supabase.com](https://supabase.com)
4. **TRON Nile wallet** — สำหรับ deploy contracts (optional)
5. **Telegram bot token** (optional, สำหรับ notifications)

---

## Step 1 — Supabase Setup

### 1.1 สร้าง Project

1. ไป [Supabase Dashboard](https://supabase.com/dashboard)
2. **New project** → ตั้งชื่อ + region (เลือก Singapore สำหรับ latency ที่ดี)
3. เก็บ:
   - `Project URL`
   - `anon public key`
   - `service_role key` (secret!)
   - `Database password`

### 1.2 รัน SQL Migrations

ดู [MIGRATIONS.md](MIGRATIONS.md) สำหรับลำดับ

ลำดับเริ่มต้นเร็วๆ:
1. SQL Editor → `manual_schema_drift_fix_v2.sql`
2. `manual_fix_id_defaults.sql`
3. `manual_fix_timestamp_defaults.sql`
4. ... (ตาม MIGRATIONS.md)

**สำคัญ**: รัน `manual_trpb_recovery.sql` แทน `manual_trpb_offchain_ledger.sql` (idempotent + diagnostic-safe)

### 1.3 Auth Configuration

**Authentication → Providers**:
- Email enabled (default)
- Confirm email = OFF (สำหรับ pilot, ไม่งั้น user ต้อง verify email)

**Authentication → URL Configuration**:
- Site URL: `https://your-domain.vercel.app`
- Redirect URLs: 
  - `http://localhost:3000`
  - `https://your-domain.vercel.app`

### 1.4 Storage Buckets

migrations รันแล้วจะมี buckets:
- `job-images` (public, 10MB)
- `official-documents` (public, 50MB)

ตรวจที่ **Storage** ใน dashboard ว่าทั้ง 2 มีอยู่จริง

### 1.5 ตั้ง First Admin User

```sql
-- ใน SQL Editor — เปลี่ยน email ตามต้องการ
UPDATE skc_users
   SET role = 'superadmin',
       approval_status = 'APPROVED'
 WHERE email = 'admin@rmutl.ac.th';
```

จากนั้น user คนนั้นจะ login ได้สิทธิ์เต็ม

---

## Step 2 — Vercel Setup

### 2.1 Import Repo

1. [vercel.com](https://vercel.com) → **New Project**
2. Import `worrajak/skillchain_rmutl` (เลือก folder `skillchain-web3`)
3. Framework: Next.js (auto-detect)
4. Build command: `npm run build` (default)
5. Output directory: `.next` (default)

### 2.2 Environment Variables

ตั้งใน **Project Settings → Environment Variables**:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # secret — server only

# TRON (optional, mirror only)
TRON_DEPLOYER_PRIVATE_KEY=d31151...        # 64 hex chars (deployer wallet)
NEXT_PUBLIC_TRON_FULL_HOST=https://nile.trongrid.io
NEXT_PUBLIC_TRON_NETWORK=nile
NEXT_PUBLIC_TRPB_TOKEN_ADDRESS=TAj5Fy9GHSG4h6FuyHt9BLEDyFmqqPyFBt
NEXT_PUBLIC_JOB_ESCROW_ADDRESS=TPDJ6DzbYGeEkjZyp7VpC95cLizPXEgWT5

# Gov workflow
ENFORCE_GOV_GATE=false                     # pilot mode (default)
# ENFORCE_GOV_GATE=true                    # production with full paperwork

# Telegram (optional)
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_OWNER_CHAT_ID=6357711108

# Wallet encryption (for auto-generated TRON wallets)
WALLET_ENCRYPTION_KEY=32-byte-base64-key   # generate with openssl rand -base64 32
```

**กำหนด environment scope**:
- `Production` — main branch
- `Preview` — PR previews (สามารถใช้ same Supabase project หรือแยก dev/prod)
- `Development` — local `vercel dev`

### 2.3 Deploy

```bash
# Auto on git push to main
git push origin main

# Or manual:
npx vercel --prod
```

Vercel will:
1. Install deps
2. Run build
3. Deploy to edge network
4. ~1-2 นาที

---

## Step 3 — TRON Nile Setup (Optional)

ถ้าต้องการ on-chain mirror หรือ release escrow on-chain:

### 3.1 สร้าง Deployer Wallet

```bash
# ติดตั้ง TronLink Extension
# สร้าง wallet ใหม่ → เปลี่ยน network เป็น Nile testnet
# Copy private key + address
```

### 3.2 ขอ TRX ฟรี

[Nile Faucet](https://nileex.io/join/getJoinPage) → ขอ TRX (สำหรับ gas)

### 3.3 Deploy Contracts

```bash
cd skillchain-web3
node scripts/deploy-nile.mjs
```

Script จะ:
1. Compile `contracts/TRPBToken.sol` + `contracts/JobEscrow.sol`
2. Deploy ทั้ง 2 contract
3. Mint 1,000,000 TRPB ให้ deployer wallet
4. แสดง contract addresses

ใส่ addresses ใน Vercel env vars:
- `NEXT_PUBLIC_TRPB_TOKEN_ADDRESS`
- `NEXT_PUBLIC_JOB_ESCROW_ADDRESS`

> **หมายเหตุ**: ใน pilot mode TRON ไม่ถูกเรียกอัตโนมัติ — ledger off-chain เป็นหลัก

---

## Step 4 — Post-Deploy Verification

### 4.1 Smoke Test

1. เปิด `https://your-domain.vercel.app`
2. Login ด้วย admin@rmutl.ac.th
3. ตรวจ:
   - `/admin/dashboard` — สถิติแสดง
   - `/admin/trpb` — SYSTEM Pool 1,000,000
   - `/admin/wallets` — รายชื่อ user
   - `/wallet` — ยอดของ admin
4. ลองสร้างผู้ใช้ + งาน → flow ทั่วไป

### 4.2 ตรวจ env vars

```bash
# Vercel CLI
vercel env ls
# หรือดูใน Dashboard
```

### 4.3 ตรวจ build logs

ใน Vercel Dashboard → Deployments → คลิก deployment → Build logs
ต้องไม่มี TypeScript errors

---

## Step 5 — Custom Domain (Optional)

1. **Project Settings → Domains** ใน Vercel
2. Add domain: `skillchain.rmutl.ac.th`
3. Configure DNS (ผ่าน RMUTL IT):
   ```
   CNAME skillchain → cname.vercel-dns.com
   ```
4. Vercel auto-provisions SSL (Let's Encrypt)

อัปเดต Supabase URL Configuration ให้ตรง

---

## Local Development

```bash
git clone https://github.com/worrajak/skillchain_rmutl.git
cd skillchain_rmutl/skillchain-web3
npm install
cp .env.example .env.local
# แก้ค่าใน .env.local ให้ตรงกับ Supabase project (อาจใช้ project เดียวกับ prod ถ้าไม่กลัวข้อมูลผสม)
npm run dev          # http://localhost:3000
```

### Useful scripts

```bash
npm run dev              # Turbopack dev server
npm run build            # Production build (test before push)
npm run start            # Run production build locally
npm run lint             # ESLint
npx tsc --noEmit         # TypeScript check (no emit)

# Migrations
node scripts/run-migrations.mjs   # ลองรัน migrations local (อ่านจาก prisma/migrations)

# TRON
node scripts/deploy-nile.mjs      # Deploy contracts to Nile
node scripts/create-wallet.mjs    # สร้าง TRON wallet ใหม่
```

---

## Continuous Deployment

```
git push origin main
       ↓
GitHub webhook → Vercel
       ↓
Vercel: install + build + deploy
       ↓
Auto-rollout (zero downtime)
```

PR previews:
- เปิด PR → Vercel deploy preview branch
- URL: `https://skillchain-rmutl-pr-123.vercel.app`
- comment ใน PR แสดง preview link

---

## Production Checklist

ก่อน go live ต้องทำ:

### Security
- [ ] `SUPABASE_SERVICE_ROLE_KEY` อยู่ใน server-only env (ไม่ใช่ NEXT_PUBLIC_*)
- [ ] `TRON_DEPLOYER_PRIVATE_KEY` ใน Vercel env (encrypted at rest)
- [ ] RLS policies เปิดทุก table (ดู `manual_rls_policies.sql`)
- [ ] Rate limiting ใช้กับทุก write endpoint
- [ ] CORS configured (ถ้ามี API external)

### Database
- [ ] รัน migrations ครบ (ดู MIGRATIONS.md)
- [ ] First admin user upgraded เป็น superadmin
- [ ] SYSTEM TRPB pool = 1,000,000
- [ ] Storage buckets ครบ + public

### Monitoring
- [ ] Vercel logs accessible
- [ ] Supabase logs accessible
- [ ] Telegram bot tested (ถ้าใช้)
- [ ] Error alerting (Sentry / Slack webhook?)

### User Communication
- [ ] First user created + verified
- [ ] Documentation accessible (README + USER_GUIDE_TH)
- [ ] Support contact ระบุชัดเจน

---

## Rollback

ถ้าเจอปัญหาหลัง deploy:

```bash
# Vercel — instant rollback to previous deployment
vercel rollback

# หรือผ่าน Dashboard → Deployments → click deployment → "Promote to Production"
```

Database rollback ทำยากกว่า — backup before migrations:
- Supabase Dashboard → Database → Backups (daily auto)
- Manual: `pg_dump` ผ่าน Supabase CLI

---

## Cost Estimate (Pilot)

- **Vercel**: Hobby plan free (สำหรับ pilot 1-2 user concurrent)
  - Pro $20/month ถ้าต้องการ team + analytics
- **Supabase**: Free tier (500MB DB, 1GB storage, 50K MAU)
  - Pro $25/month ถ้าเกิน
- **TRON Nile**: ฟรี (testnet)
- **Domain**: ~ 500 บาท/ปี ถ้าจดเอง

รวม pilot: **0 - $25/month**

---

## Related Docs

- [MIGRATIONS.md](MIGRATIONS.md) — SQL setup
- [SECURITY.md](SECURITY.md) — Security model
- [tron-setup.md](tron-setup.md) — TRON setup details (เก่า)
- [setup-supabase.md](setup-supabase.md) — Supabase setup details (เก่า)
