# Supabase Setup

ขั้นตอนการตั้ง Supabase project สำหรับ SkillChain RMUTL

## 1. สร้าง Project

1. เข้า https://supabase.com → New project
2. เลือก region ใกล้ไทย (Singapore)
3. เก็บค่าต่อไปนี้ใส่ `.env.local`
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
   - `DATABASE_URL` / `DIRECT_URL` — connection string จาก Settings → Database

## 2. รัน SQL ตั้งต้น

มี SQL หลายไฟล์ใน root ของ repo — **แนะนำใช้ไฟล์รวมไฟล์เดียว**

### วิธีง่ายที่สุด (รันครั้งเดียวจบ)
เปิด **Supabase SQL Editor** แล้ว copy ทั้งไฟล์
```
supabase-setup-all.sql
```
แล้วกด Run — ปลอดภัย รันซ้ำได้

### หรือรันแยกตามลำดับ
ถ้าอยากเข้าใจทีละส่วน รันตามลำดับนี้

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 1 | `supabase-init.sql` | สร้างตารางและ enum หลัก |
| 2 | `supabase-roles.sql` | สิทธิ์ role 8 ประเภท |
| 3 | `supabase-permissions.sql` | RLS policies |
| 4 | `supabase-auth-trigger.sql` | trigger ผูก auth.users → public.users |
| 5 | `supabase-credential.sql` | ระบบ credential 5 levels |
| 6 | `supabase-reviews.sql` | multi-source reviews |
| 7 | `supabase-lifecycle.sql` | job lifecycle + eval windows |
| 8 | `supabase-trpb.sql` | TRPB token tables |
| 9 | `supabase-governance.sql` | approval / audit |

> **หมายเหตุ:** `supabase-all.sql` เป็นชุดรวมเก่ากว่า — ถ้าจะใช้ ให้ใช้ `supabase-setup-all.sql` แทน

## 3. Sync กับ Prisma

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

## 4. ตั้ง Auth

ใน Supabase Dashboard → Authentication → Providers
- เปิด Email (เป็นค่า default)
- ตั้ง Site URL = `http://localhost:3000` (dev) หรือ domain จริง (prod)
- เพิ่ม redirect URL ตาม environment

## 5. ตรวจสอบ

```bash
npm run dev
```
แล้วลอง sign up ใหม่ — ควรเห็น row ใน `auth.users` และ `public.users` พร้อมกัน
(ถ้าไม่มี ให้กลับไปเช็ก `supabase-auth-trigger.sql`)

## Troubleshooting

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `relation "public.users" does not exist` | ยังไม่ได้รัน `supabase-init.sql` |
| สมัครแล้วไม่มี row ใน `public.users` | trigger ไม่ทำงาน — รัน `supabase-auth-trigger.sql` ใหม่ |
| Prisma error: `P1001` | `DATABASE_URL` ผิด หรือ project pause อยู่ |
| RLS denied | ลืมรัน `supabase-permissions.sql` หรือยังไม่ approve user |
