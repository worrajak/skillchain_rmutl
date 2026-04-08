# TRON Setup (Nile Testnet)

คู่มือเตรียม wallet และ testnet TRX สำหรับทดสอบฟีเจอร์ on-chain

## 1. ติดตั้ง TronLink

- Chrome extension: https://www.tronlink.org/
- Mobile: TronLink app บน iOS / Android

## 2. สลับเป็น Nile Testnet

1. เปิด TronLink → คลิกชื่อเครือข่ายด้านบน
2. เลือก **Nile Testnet**
3. ถ้าไม่มี → Settings → Node → Add Custom Node
   - Name: `Nile`
   - Full Node: `https://nile.trongrid.io`
   - Solidity Node: `https://nile.trongrid.io`
   - Event Server: `https://event.nileex.io`

## 3. ขอ Testnet TRX (ฟรี)

- Faucet: https://nileex.io/join/getJoinPage
- ใส่ wallet address แล้วกด request
- รอ ~30 วินาที จะได้ TRX มาทดสอบ

## 4. เพิ่ม TRPB Token

1. TronLink → Assets → Add Token
2. ใส่ contract address ของ TRPB (ดูใน `.env.local` หรือถามผู้ดูแล)
3. คลิก Add

## 5. ทดสอบใน SkillChain

- เปิดเว็บ → login → ไปที่หน้า profile / wallet
- กด "Connect TronLink"
- ควรเห็น address และ TRPB balance แสดงใน navbar

## Env vars ที่ต้องตั้ง

ดู [.env.example](../.env.example)
- `NEXT_PUBLIC_TRON_FULL_HOST=https://nile.trongrid.io`
- `NEXT_PUBLIC_TRON_NETWORK=nile`
- `NEXT_PUBLIC_JOB_ESCROW_ADDRESS=...`
- `NEXT_PUBLIC_TRPB_TOKEN_ADDRESS=...` *(เพิ่มเข้ามาใหม่ — ดู smart-contracts.md)*

## Explorer

- Nile Tronscan: https://nile.tronscan.org/
- ใช้ค้น tx hash ที่บันทึกไว้ใน DB (`Job.escrow_tx`, `StudentCredential.nft_tx_hash`, ฯลฯ)

## Troubleshooting

| อาการ | วิธีแก้ |
|---|---|
| `tronWeb is not defined` | ยังไม่ได้เปิด TronLink หรือยังไม่ได้ inject |
| `CONTRACT_VALIDATE_ERROR` | TRX ไม่พอจ่าย energy/bandwidth |
| `Invalid network` | TronLink อยู่ Mainnet — สลับเป็น Nile |
| Balance เป็น 0 | ขอจาก faucet ใหม่ หรือเช็ค address ใน Tronscan |
