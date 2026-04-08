# Contributing

ขอบคุณที่สนใจร่วมพัฒนา SkillChain RMUTL 🙏

## ข้อตกลงสำคัญก่อนเริ่ม

1. **อ่าน [AGENTS.md](AGENTS.md)** — Next.js เวอร์ชันนี้มี breaking changes อย่าใช้ความรู้เก่า
2. **อย่าแก้โค้ดที่ยังไม่ได้อ่าน** — เปิดไฟล์อ่านก่อนเสมอ
3. **อย่าทำเกินกว่าที่ขอ** — bug fix ไม่ต้อง refactor รอบข้าง

## Workflow

1. Fork / สร้าง branch จาก `main`
2. ตั้งชื่อ branch ตามรูปแบบ
   - `feat/<ชื่องาน>` — feature ใหม่
   - `fix/<ชื่อ bug>` — แก้ bug
   - `chore/<งาน>` — งานทั่วไป (deps, config)
   - `docs/<หัวข้อ>` — เอกสาร
3. Commit ตาม Conventional Commits
   ```
   feat: เพิ่ม TRPB balance badge ใน navbar
   fix: remove FK join dependency for approved_by_staff
   docs: อัพเดต README
   ```
4. รัน `npm run lint` และ `npm run build` ให้ผ่านก่อน push
5. เปิด PR ไปที่ `main` พร้อมกรอก template

## Database Changes

- แก้ `prisma/schema.prisma` แล้วรัน `npx prisma migrate dev --name <ชื่อ>`
- commit ทั้ง schema และ migration ใหม่
- ถ้ามี seed data ใหม่ ให้แก้ `prisma/seed.ts`

## Smart Contract Changes

- contracts อยู่ที่ [contracts/](contracts/)
- หลัง deploy ใหม่ ต้องอัพเดต address ใน `.env.local` และ doc ที่เกี่ยวข้อง
- ใช้ Nile Testnet เท่านั้นในการทดสอบ — **ห้าม** deploy ขึ้น Mainnet โดยไม่ได้รับอนุมัติ

## Code Style

- TypeScript strict — ห้าม `any` ถ้าเลี่ยงได้
- ใช้ shadcn/ui + Tailwind v4 conventions ที่มีอยู่
- ตั้งชื่อตัวแปรเป็นภาษาอังกฤษ, comment เป็นไทยได้ถ้าช่วยให้เข้าใจง่ายขึ้น

## Reporting Issues

เปิด issue พร้อมข้อมูลต่อไปนี้
- Steps to reproduce
- Expected vs actual behavior
- Screenshot / log ถ้ามี
- Environment (OS, Node version)
