# Smart Contracts

ทุกสัญญา deploy บน **TRON Nile Testnet** เท่านั้น

## TRPBToken (`contracts/TRPBToken.sol`)
TRC-20 token ใช้เป็นหน่วยจ่ายเงินภายในระบบ

- Symbol: `TRPB`
- ใช้ใน Job Escrow และแสดง balance ใน navbar
- Address: ตั้งใน `NEXT_PUBLIC_SKILL_CREDENTIAL_ADDRESS` / TRPB env (ดู `.env.example`)

## JobEscrow (`contracts/JobEscrow.sol`)
ถือเงินรางวัลของแต่ละงานและปล่อยตามสถานะ

State หลัก:
- `lock(jobId, amount)` — employer lock เงินตอนสร้างงาน
- `release(jobId, to)` — ปล่อยเงินให้นักศึกษาเมื่อ COMPLETED
- `refund(jobId)` — คืนเงินให้ employer เมื่อ CANCELLED / DISPUTED ที่ตัดสินคืน

Address: `NEXT_PUBLIC_JOB_ESCROW_ADDRESS`

## Deployment

1. ตั้ง private key ใน TronLink (Nile)
2. Compile ด้วย TronBox / Remix
3. Deploy → copy address ใส่ `.env.local`
4. ทดสอบด้วย `src/lib/tron/*` helpers

## ความปลอดภัย

- ห้ามเก็บ private key ใน repo
- เงินจริงทดสอบเฉพาะ Nile Testnet
- ทุก tx hash ถูกบันทึกในตาราง `jobs.escrow_tx`, `evaluations.on_chain_tx`, `student_credentials.nft_tx_hash` เพื่อ audit
