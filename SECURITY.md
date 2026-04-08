# Security Policy

## รายงานช่องโหว่

หากพบช่องโหว่ด้านความปลอดภัย **กรุณาอย่าเปิดเป็น public issue**

ส่งรายงานทางช่องทางต่อไปนี้แทน:
- Email: `worrajak@rmutl.ac.th`
- หรือใช้ GitHub Security Advisory (Private vulnerability reporting) ที่ tab **Security** ของ repo

ระบุข้อมูลให้มากที่สุดเท่าที่ทำได้:
- ขั้นตอน reproduce
- ผลกระทบที่อาจเกิด
- เวอร์ชัน / commit hash ที่พบ
- PoC (ถ้ามี)

เราจะตอบกลับภายใน **7 วันทำการ** และจะประสานงานเรื่อง disclosure timeline

## ขอบเขต

ช่องโหว่ที่อยู่ในขอบเขต:
- Authentication / authorization bypass
- SQL injection, XSS, CSRF
- ช่องโหว่ใน smart contracts (`contracts/TRPBToken.sol`, `contracts/JobEscrow.sol`)
- การรั่วไหลของข้อมูลผู้ใช้
- Privilege escalation ระหว่าง role

นอกขอบเขต:
- ปัญหาบน Nile Testnet ที่เกิดจากเครือข่ายเอง
- Social engineering
- DoS โดยใช้ทรัพยากรจำนวนมาก

## Supported Versions

ตอนนี้ support เฉพาะ branch `main` เท่านั้น

## Best Practices สำหรับผู้ deploy

- อย่า commit `.env.local` หรือ private key
- หมุน Supabase service role key เป็นระยะ
- ใช้ Nile Testnet เท่านั้นจนกว่าจะมี audit สำหรับ Mainnet
- เปิด RLS (Row Level Security) บน Supabase ทุกตาราง
