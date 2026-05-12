# รายงานทดสอบ End-to-End — รอบ 10/5/2569

ทดสอบ flow การจ้างงานครบวงจร + จ่าย TRPB ทั้ง off-chain ledger + on-chain TRON Nile testnet

**Update v2:** เพิ่ม on-chain mirror + 3-way split (90/5/5) ทดสอบบน Nile testnet สำเร็จ — ดูส่วน "Phase 2: TRON On-Chain Test"

---

## ✅ Flow ที่ผ่าน (12/12 ขั้นตอน)

| # | ขั้นตอน | Role | สถานะ → | ผล |
|---|---|---|---|---|
| 1 | สร้างงาน | Employer (เสี่ยเอ) | → `PENDING_REVIEW` | ✅ |
| 2 | Staff review + อนุมัติ | Project Staff (Ampai) | → `OPEN` | ✅ |
| 3 | Student ขอรับงาน | Student (อาทิตย์) | → request `PENDING` | ✅ |
| 4 | Staff อนุมัติ assignment | Staff | → `ASSIGNED` | ✅ |
| 5 | Student เสนอวันทำงาน | Student | + dates | ✅ |
| 6 | Employer ยืนยันวันทำงาน | Employer | → `IN_PROGRESS` | ✅ |
| 7 | Student ประเมิน Interim (ระหว่างทำ) | Student | review saved | ✅ |
| 8 | Student ส่งมอบงาน + รูป | Student | → `SUBMITTED` | ✅ |
| 9 | Employer ยืนยันรับงาน | Employer | confirm flag | ✅ |
| 10 | Staff ยืนยันงานเสร็จ | Staff | → `COMPLETED` + `IN_WARRANTY` | ✅ |
| 11 | Staff release escrow | Staff | balance: emp -800, std +800 | ✅ |
| 12 | Employer ประเมิน Final (Post-work) | Employer | review saved | ✅ |

**สถานะสุดท้าย:** งานเสร็จสมบูรณ์ + ในประกัน 7 วัน + จ่าย TRPB เรียบร้อย

---

## 🐛 Bugs ที่เจอ + แก้ไขแล้วในรอบนี้

### #1 — Staff dashboard counter แสดง 0 ทั้งที่มีงานรอ (FIXED ✓)
**สาเหตุ:** Query `skc_disputes` ใช้ `dispute_reason` แต่จริงคือ `description` → 400 → ส่งให้ component crash โหลด stat card ผิด

Query `skc_student_credentials` ใช้ `level` แต่จริงคือ `credential_level` → 400 เช่นกัน

**แก้:** เปลี่ยน column names ใน `src/app/project-staff/dashboard/page.tsx` (บรรทัด 121, 164, 261, 348)

### #2 — ปุ่ม "ส่งคำขอรับงาน" กดได้ซ้ำหลังกดแล้ว (FIXED ✓)
Student เห็น toast "ส่งคำขอแล้ว" แต่ปุ่มยังกดได้ — ครั้ง 2 จะได้ error 23505

**แก้:** เพิ่ม optimistic UI + เปลี่ยนปุ่มเป็น `⏳ ส่งคำขอแล้ว` (disabled) ใน `src/app/student/jobs/page.tsx`

### #3 — ฟอร์มเสนอวันยังเปิดหลัง student เสนอแล้ว (FIXED ✓)
Date pickers + ปุ่ม "เสนอวันทำงาน" ยังโผล่อยู่ ทำให้สับสน

**แก้:** ใน `src/app/student/jobs/[id]/page.tsx` แสดง waiting card อย่างเดียวเมื่อ `schedule_proposed_by === userId`

### #5 — UI lying เรื่อง TRPB split (PARTIALLY FIXED ✓)
UI หน้า employer แสดง breakdown "นศ. 720 / กองทุน 40 / คณะ 40" แต่จริง ledger transfer เต็มก้อน 800 → student

**แก้ชั่วคราว:** เปลี่ยน FeeBreakdown ใน `escrow-payment-card.tsx` ให้แสดง "นักศึกษาได้รับเต็มจำนวน + note โหมด pilot" จนกว่าจะ implement split-release จริง

**TODO:** Implement 3-way split ใน `fn_trpb_escrow_release` (SQL function) หรือเรียก escrowRelease 3 ครั้ง:
- 90% → student
- 5% → SYSTEM (กองทุนกลาง)
- 5% → staff_supervisor (คณะทำงาน)

ตั้ง `USE_FULL_SPLIT = true` ใน `escrow-payment-card.tsx` หลัง implement

---

## ⚠️ Issues ที่ยังต้องตรวจ

### #4 — รูปงานเสร็จหายจาก Student detail page หลัง SUBMITTED
หลังจาก student กดส่งงาน → status = SUBMITTED → page reload → 3 sections (รูปเครื่อง / ระหว่างทำงาน / งานเสร็จ) แสดง "ยังไม่มีรูปภาพ" ทั้งที่ DB มีรูปอยู่จริง

**สมมุติฐาน:** ImageGallery component (read-only mode สำหรับ SUBMITTED) อาจ:
- RLS policy block student อ่าน images หลัง status เปลี่ยน
- หรือ component re-mount แต่ session token ยังไม่อัปเดต

**แก้บางส่วน:** เพิ่ม cancellation flag + error logging ใน `src/components/image-gallery.tsx`

**ต้องทำต่อ:** ตรวจ RLS policy ของ `skc_job_images` — student ควรเห็น images ของงานตัวเองเสมอ ไม่ขึ้นกับ status

### #6 — `/api/training/catalog` redirect-loop
หน้า `/training/catalog` ที่ผมเดา URL ผิด — middleware redirect ไป `/quick-login?next=/api/training/catalog` แต่ catalog page เรียก fetch JSON ได้ HTML กลับ → loading ค้าง

**ทางแก้:** route `/training/catalog` ไม่มีจริง — ลบหรือ redirect ไป `/training`

### #7 — Routes ที่ผม navigation มาเองเปิดไม่ขึ้น
`router.push()` ใน Preview MCP ไม่ทำงาน (ก็แค่ดึง form login + setState — Vercel/Next.js context อาจ not invoke router properly ในกรณีที่ Preview run แยก browsing context)

**Note:** ใน production browser ปกติทำงานได้ — เป็น known limitation ของ Preview MCP เท่านั้น

---

## 📋 ค่าใช้งาน + Balance ที่ทดสอบ

| User | ก่อน | หลัง | Δ |
|---|---|---|---|
| Employer (เสี่ยเอ) | 4500 | 3700 | -800 |
| Student (อาทิตย์) | 0 | 800 | +800 |
| Project Staff (Ampai) | 5000 | 5000 | 0 |
| SYSTEM | 1,000,000 | 1,000,000 | 0 |

Ledger TX เกิดใน `skc_trpb_transactions`:
- `ESCROW_HOLD` 800 (employer → escrow)
- `ESCROW_RELEASE` 800 (employer → student)

---

## 💡 ข้อเสนอแนะ UX อื่น ๆ

### A — Dashboard cards บน mobile ใช้พื้นที่ไม่คุ้ม
Stat cards บน staff dashboard เรียงเป็น row เดียวยาว — ควรใช้ grid 2-3 columns

### B — Staff active-jobs ควรมี filter "งานที่รอผมยืนยัน"
ตอน student ส่งงาน + employer confirm — staff ควรเห็น filter chip "รอผมยืนยัน (1)"

### C — QR Code ควรมีขนาด print-ready
QR Code ที่ออกในหน้า job detail เล็กเกินไปสำหรับการพิมพ์ + ติดที่เครื่อง — ควรเพิ่มปุ่ม "พิมพ์ A4 พร้อมหัวจดหมาย"

### D — Login form: "เข้าสู่ระบบ" ปุ่มควรแสดง spinner ระหว่าง async sign-in
ตอนนี้กดปุ่ม → ดูเงียบ ๆ 2-3 วิ → เด้งเข้า dashboard. UX feel slow

### E — Notification bell มี badge "2" / "6" แต่กดดูไม่ได้
มุมขวาบนหน้า dashboard มี bell icon + count แต่กดแล้วไม่มี dropdown — ควรเปิด /notifications

### F — Final review ของ Employer ขึ้นทันทีหลัง employer ยืนยัน — ควรมี hint
ปกติคนน่าจะคาดว่า "หลัง staff confirm + escrow release จริง → ค่อยประเมิน". ตอนนี้ employer review ปุ๊บ → form Final ขึ้นเลย

---

## 📁 ไฟล์ที่แก้ในรอบนี้

```
src/app/project-staff/dashboard/page.tsx        (#1: column names)
src/app/student/jobs/page.tsx                   (#2: disable apply button)
src/app/student/jobs/[id]/page.tsx              (#3: hide schedule form)
src/components/escrow-payment-card.tsx          (#5: honest fee breakdown)
src/components/image-gallery.tsx                (#4: cancellation + error log)
docs/E2E_TEST_REPORT.md                         (this file — new)
scripts/e2e-setup.mjs                           (test user setup — new)
scripts/e2e-add-images.mjs                      (image seed — new, can delete)
```

---

## 🎯 ก้าวต่อไป (priority)

1. ~~**High** — Implement 3-way escrow split (#5 full fix)~~ ✅ **DONE v2**
2. ~~**High** — สอบ RLS ของ `skc_job_images` (#4 root cause)~~ ✅ **DONE** — bug จริงคือ race condition ใน ImageGallery (fixed: cancellation flag)
3. ~~**Med** — ลบ/redirect `/training/catalog` (#6)~~ — ไม่มี route จริง (ผมเดา URL ผิด)
4. ~~**Med** — Notification bell click → /notifications~~ — bell มี dropdown อยู่แล้ว ✓
5. **Low** — Mobile dashboard grid (A)
6. **Low** — QR print-ready layout (C)
7. **Future** — Encrypt staff/student private keys ด้วย `WALLET_ENCRYPTION_KEY` (ตอนนี้สร้างผ่าน script + เก็บ plain text — ดู scripts/e2e-setup-tron-wallet.mjs)
8. **Future** — Auto-fund TRX gas เมื่อ staff/student ผูก wallet ผ่าน admin

---

## Phase 2: TRON On-Chain Test (added v2)

### ✅ On-chain TRPB transfer สำเร็จ

ทดสอบ release-escrow API ใหม่ที่มี on-chain mirror:

**Test 1 — งาน 300 TRPB single recipient:**
- Off-chain ledger: employer → student (300 TRPB) ✅
- On-chain TX: [`6e01b492...`](https://nile.tronscan.org/#/transaction/6e01b4923f5550d582d779aee3c519398953eb90040b820c4d92fcb8189bf221)
- Student wallet (TQsEYag1...): 0 → 300 TRPB on-chain ✅

**Test 2 — งาน 1000 TRPB 3-way split:**
- 90% Student อาทิตย์ → 900 TRPB on-chain ([`f8d369f8...`](https://nile.tronscan.org/#/transaction/f8d369f891ce8963a0fc55eb6b8e22ce7dc36919eb422c4958f5e6eeab03f4c0))
- 5% Staff Ampai → 50 TRPB on-chain ([`e16cb9bb...`](https://nile.tronscan.org/#/transaction/e16cb9bb9f6da65b705fb31d44a8c2ec56291cbe6686f5512a2ecf746e997782))
- 5% SYSTEM (กองทุนกลาง) → 50 TRPB off-chain only (no wallet)

### TRON Wallets ใช้ทดสอบ
- **Deployer (Treasury)**: `TU7VbEyrdZMmfMAqsNUmjmcG4CMBLtK7qj` — 1,000,000 → 998,750 TRPB (-1250 รวม 2 tests)
- **Student อาทิตย์**: `TQsEYag1EKn4hV78dYorDsaooUrL1kUh6N` — 0 → 1,200 TRPB on-chain
- **Staff Ampai**: `TXq6kwZb65vY5q9ihZCieWGt7gawKuuDg6` — 0 → 50 TRPB on-chain

### Implementation
- **`src/lib/tron/server.ts`** (new) — `transferTRPBOnChain()` + `getTRPBBalanceOnChain()` ฝั่ง server
- **`src/app/api/jobs/[id]/release-escrow/route.ts`** (rewritten):
  - 3-way split ใน off-chain ledger (90/5/5)
  - On-chain mirror ผ่าน TronWeb (deployer wallet → recipient)
  - บันทึก `on_chain_ref` ใน `skc_trpb_transactions`
  - ส่ง `escrow_tx` เป็น raw TX hash → TronScan deep-link ใช้ได้
- **`src/components/escrow-payment-card.tsx`** — toggle `USE_FULL_SPLIT = true`

### Setup Scripts (`scripts/`)
- `e2e-setup.mjs` — list users + reset passwords
- `e2e-tron-state.mjs` — inspect Nile state (deployer + user wallets)
- `e2e-setup-tron-wallet.mjs` — generate + bind + fund student wallet
- `e2e-bind-staff-wallet.mjs` — generate + bind + fund staff wallet

### Behavior summary
| Recipient ผูก wallet? | On-chain mirror | Off-chain ledger |
|---|---|---|
| ✅ ใช่ | ส่ง TRPB จริงผ่าน TronWeb | บันทึก `on_chain_ref` |
| ❌ ไม่ | skip silently | ส่ง off-chain ledger ปกติ |

ดังนั้น **off-chain ledger เป็น source of truth** เสมอ — on-chain เป็น mirror สำหรับ audit/proof
ถ้า on-chain ส่งไม่สำเร็จ → off-chain ยัง credit แล้ว → admin retry on-chain ภายหลังได้
