# Proposal: Verifiable Credential (W3C VC) & DID

> สถานะ: **DRAFT** | 2026-04-08
> ระดับความสำคัญ: 🟠 ทำให้ vision "ตรวจสอบได้" สมบูรณ์

## 1. ปัญหา

ตอนนี้ credential ของ SkillChain เป็น:
- row ใน DB (`StudentCredential`)
- + tx hash บน TRON

ปัญหา:
- คนนอกระบบ verify ไม่ได้ถ้าไม่เชื่อ SkillChain
- ไม่ portable — ย้ายไป platform อื่นไม่ได้
- ไม่ standard — partner (สพร./สคช./บริษัท) ต้องเขียน integration เอง

## 2. ข้อเสนอ

ยกระดับเป็น **W3C Verifiable Credentials (VC)** + **Decentralized Identifier (DID)**

### 2.1 DID
- ทุก user ที่ public มี DID เช่น `did:tron:nile:T...` หรือ `did:web:skillchain.rmutl.ac.th:talent:somchai`
- Wallet (TronLink) เป็น key holder

### 2.2 VC Format
ทุก credential ออกเป็น JSON-LD ตามมาตรฐาน W3C VC v2:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://skillchain.rmutl.ac.th/contexts/v1"
  ],
  "type": ["VerifiableCredential", "SkillCredential"],
  "issuer": "did:web:skillchain.rmutl.ac.th",
  "validFrom": "2026-04-08T00:00:00Z",
  "credentialSubject": {
    "id": "did:tron:nile:T...",
    "name": "นายสมชาย ทดสอบ",
    "credentialLevel": 3,
    "certifyingBody": "RMUTL_TEACHER",
    "skills": [
      {"code": "EL-002", "proficiency": 85}
    ],
    "evidenceUrl": "ipfs://Qm..."
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-jcs-2022",
    "proofValue": "..."
  }
}
```

### 2.3 Verification Endpoint
- `/api/vc/verify` — รับ VC JSON → ตอบ valid/invalid + reason
- `/api/vc/[id]` — public ดึง VC ของ credential ใดก็ได้
- QR code ที่หน้า talent profile → scan → เข้า verifier

## 3. Schema

ขยาย `StudentCredential` เดิม:
```prisma
model StudentCredential {
  // ... existing
  vc_jwt        String?      // VC ในรูป JWT
  vc_json_url   String?      // ลิงก์ JSON-LD
  did_subject   String?
  proof_type    String?
}
```

ตารางใหม่สำหรับ DID:
```prisma
model UserDid {
  user_id    String   @id
  did        String   @unique
  method     String                       // "tron" | "web"
  public_key String
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id])
  @@map("user_dids")
}
```

## 4. Implementation Path

| ขั้น | เนื้อหา |
|---|---|
| 1 | เลือก library: `@digitalbazaar/vc` หรือ `did-jwt-vc` |
| 2 | สร้าง issuer key (มทร.ล้านนา) เก็บใน secret store |
| 3 | Issue VC ตอน mint NFT credential ปัจจุบัน — เก็บ JWT ใน DB |
| 4 | สร้างหน้า public verifier |
| 5 | สร้าง QR + export wallet (download .json) |
| 6 | ทดสอบกับ verifier มาตรฐาน เช่น https://vc.example.edu/verify |

## 5. Standards Compliance

- W3C Verifiable Credentials Data Model v2.0
- DID Core v1.0
- เลือก method: `did:web` (ง่ายสุด) → `did:tron` (decentralize เต็ม)
- รองรับ revocation list (StatusList2021)

## 6. Use Cases

| Actor | Action |
|---|---|
| นศ. | download VC → upload สมัครงานบริษัทนอกระบบ |
| Employer ภายนอก | scan QR → verify โดยไม่ต้อง login SkillChain |
| สพร./สคช. | API integration → import VC ของผู้สมัครสอบ |
| มหาวิทยาลัยอื่น | recognize credential ข้ามสถาบัน |

## 7. ความเสี่ยง

| เสี่ยง | บรรเทา |
|---|---|
| Issuer key หลุด | HSM / key rotation นโยบายชัด |
| ผู้ใช้ไม่เข้าใจ DID/VC | UI ซ่อน complexity, แสดงเป็น "ใบรับรอง online" |
| Mainnet vs Testnet confusion | ระบุ network ในทุก VC |

## 8. Dependencies
- ต้องการ: ระบบ credential ปัจจุบัน (มีแล้ว)
- เสริม: talent-directory (แสดง VC export button)
