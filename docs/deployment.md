# Deployment

## ตัวเลือกหลัก

| Platform | เหมาะกับ | หมายเหตุ |
|---|---|---|
| Vercel | dev / staging / production | รองรับ Next.js 16 ดีที่สุด |
| Self-host (Node.js) | ภายใน มทร.ล้านนา | ใช้ `npm run build` + `npm run start` หรือ Docker |
| Supabase | DB + Auth | ใช้ร่วมกับทั้งสองแบบข้างบน |

## Vercel

1. Import repo จาก GitHub
2. Framework preset: **Next.js**
3. Build command: `npm run build`
4. Install command: `npm install`
5. ตั้ง Environment Variables ทั้งหมดจาก `.env.example`
6. Deploy

### Env Vars ที่ต้องตั้ง
ดู [.env.example](../.env.example) — ทุกตัวที่ขึ้นต้น `NEXT_PUBLIC_*` จะ expose ไป client
อย่าใส่ secret ใน var ที่ขึ้นต้น `NEXT_PUBLIC_`

## Self-host

```bash
git clone https://github.com/worrajak/skillchain_rmutl.git
cd skillchain_rmutl
npm ci
cp .env.example .env.local   # แก้ค่าให้ถูก
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start                  # default port 3000
```

แนะนำใช้ `pm2` หรือ `systemd` เป็น process manager

### ตัวอย่าง systemd
```ini
[Unit]
Description=SkillChain Web
After=network.target

[Service]
Type=simple
User=skillchain
WorkingDirectory=/opt/skillchain-web3
ExecStart=/usr/bin/npm run start
Restart=always
EnvironmentFile=/opt/skillchain-web3/.env.local

[Install]
WantedBy=multi-user.target
```

## Pre-flight Checklist

ก่อน deploy production
- [ ] ตั้ง Supabase Site URL = domain จริง
- [ ] เพิ่ม redirect URL ใน Supabase Auth
- [ ] รัน `supabase-setup-all.sql` บน production project
- [ ] เปิด Row Level Security ทุกตาราง
- [ ] Smart contract deploy + ใส่ address ใน env
- [ ] หมุน Supabase service role key
- [ ] เปิด HTTPS (Vercel ทำให้อัตโนมัติ)
- [ ] ทดสอบ flow: signup → approve → สร้างงาน → ส่งงาน → ประเมิน → release Escrow

## Rollback

- Vercel: ใช้ "Promote previous deployment"
- Self-host: `git checkout <previous tag> && npm ci && npm run build && systemctl restart skillchain`
- Database: ใช้ Supabase point-in-time restore (PITR) — ต้องเปิดไว้ก่อน
