# Isnad Trust System — Design Proposal

> นำหลัก **อิสนาด (Isnad / السند الإسنادي)** ของศาสตร์หะดีษอิสลาม มาเป็น
> อัลกอริทึมจัดอันดับความน่าเชื่อถือของผู้ใช้และข้อมูลในระบบ SkillChain
>
> ขอ confirm 6 จุดก่อน implementation

---

## 1. หลักการอ้างอิง

### ในศาสตร์หะดีษ มี 3 ระดับการตรวจ

```
┌─────────────────────────────────────────────┐
│ 1. SANAD (سند)  — สายผู้รายงาน              │
│    "ใครรายงาน? รายงานจากใคร? ผ่านใครมา?"     │
│                                              │
│ 2. MATN (متن)   — เนื้อหารายงาน              │
│    "ข้อมูลที่รายงานคืออะไร?"                 │
│                                              │
│ 3. RIJAL (رجال) — ตัวตนของผู้รายงาน          │
│    "ตัวตนของเขาน่าเชื่อถือไหม?"              │
└─────────────────────────────────────────────┘
```

### 5 เกณฑ์ Sahih (صحيح — ถูกต้อง) ของหะดีษ

| เกณฑ์ | ภาษาไทย | ในระบบ SkillChain |
|---|---|---|
| **اتصال السند** (continuous chain) | สายไม่ขาด | ทุกธุรกรรมมี approver ครบทุก step |
| **عدالة الرواة** (Adalah) | ผู้รายงานเที่ยงธรรม | ไม่เคยทุจริต, no_show ต่ำ |
| **ضبط الرواة** (Dabt) | ความแม่นยำ | ส่งงานตรงเวลา, evidence ครบ |
| **عدم الشذوذ** (no Shudhudh) | ไม่ขัดแย้งกับน่าเชื่อกว่า | ไม่มี dispute |
| **عدم العلة** (no Illah) | ไม่มีข้อบกพร่องซ่อน | identity verified |

### 4 ระดับการจัดอันดับ (Hadith classification → Trust grade)

| Hadith Grade | Range | สี | Trust Grade ในระบบ |
|---|---|---|---|
| **Sahih** (صحيح) | 90-100 | 🟢 เขียวเข้ม | สูงสุด — ระบบเชื่อโดยอัตโนมัติ |
| **Hasan** (حسن) | 70-89 | 🔵 ฟ้า | ดี — ผ่านได้ในกรณีปกติ |
| **Da'if** (ضعيف) | 40-69 | 🟡 อำพัน | อ่อน — ต้องมี evidence/approver เสริม |
| **Mawdu'** (موضوع) | 0-39 | 🔴 แดง | ไม่น่าเชื่อ — block หรือ require manual review |

---

## 2. ใช้กับอะไรในระบบ SkillChain

### Trust score 0-100 สำหรับ user ทุกคน

ทุก role มี trust score:
- **นักศึกษา** — งานเสร็จ → +score · NO_SHOW → -score · dispute lost → -score
- **ผู้จ้าง** — จ่ายตรงเวลา → +score · ละเมิด terms → -score
- **คณะทำงาน** — approve batch ผ่าน → +score · batch reject สูง → -score
- **อาจารย์** — review ตรง consensus → +score
- **มทร.** — เริ่มสูง (system trust)

### 7 use cases ที่ trust score ช่วย

```
1. กรอง spam — งานจาก trust < 40 → hidden โดย default
2. Auto-approve threshold — นศ. trust ≥ 80 → FCFS skip staff curate
3. Dispute weight — trust สูง = น้ำหนัก vote ในการตัดสินสูง
4. TRPB cap per job — trust ต่ำ = รับงานราคาสูงไม่ได้ทันที
5. Activity priority — trust สูงได้ slot ก่อนใน activity เต็มเร็ว
6. Reviewer pool — เลือก reviewer จาก top trust users
7. Recommendation — แนะนำงานให้ นศ. ตาม trust ของผู้จ้าง
```

---

## 3. อัลกอริทึม

### Trust Score Formula

```ts
trust_score = (
  identity_layer * 0.30    +  // ตัวตนยืนยัน
  track_record_layer * 0.40 +  // ประวัติการทำงาน
  chain_layer * 0.20        +  // สายผู้รับรอง
  social_proof_layer * 0.10    // คะแนนจากคนอื่น
) → clamp 0-100
```

### Layer 1 — Identity (ตัวตน · 30%)

| Item | Points |
|---|---|
| Email verified | +5 |
| Phone verified | +5 |
| Profile complete (name + avatar + ID card) | +10 |
| Approved by staff (`approval_status='APPROVED'`) | +5 |
| TRON wallet bound | +3 |
| Telegram linked | +2 |
| **Max** | **30** |

### Layer 2 — Track Record (ประวัติ · 40%)

```ts
const completed = countCompletedJobs(userId);
const total = countAllJobs(userId);
const successRate = completed / total;  // 0 - 1

let score = 0;

// Completed jobs (capped)
score += Math.min(15, completed * 1.5);  // +1.5 per job, max 15

// Success rate
score += successRate * 10;  // 0-10

// Penalties
score -= countNoShows(userId) * 3;          // -3 each
score -= countDisputesLost(userId) * 5;     // -5 each
score -= countLateSubmissions(userId) * 1;  // -1 each

return Math.max(0, Math.min(40, score));
```

### Layer 3 — Chain (สายผู้รับรอง · 20%)

ใครเป็นผู้ "vouch" ให้คุณ?
- ใครเป็น approver ตอนสมัคร (`approved_by`)
- ใครเป็น supervisor ในงานล่าสุด
- mentor relationships

```ts
const vouchers = getVouchers(userId);  // approver + supervisor history
const avgVoucherTrust = vouchers.map(v => v.trust_score).avg();

return avgVoucherTrust * 0.2;  // เอา 20% ของ avg ของผู้รับรอง
```

หลัก isnad: **"chain แข็งแค่ตัวอ่อนแอที่สุด"** — ถ้า approver มี trust ต่ำ → trust ของคุณก็ได้รับผลกระทบ

### Layer 4 — Social Proof (คะแนน · 10%)

```ts
const reviews = getReviewsAbout(userId);
const avgScore = reviews.avg() / 5;  // 0-1

return avgScore * 10;  // 0-10
```

### Trust Grade mapping

```ts
function getGrade(score: number): {
  grade: "SAHIH" | "HASAN" | "DAIF" | "MAWDU";
  label: string;
  color: string;
  arabic: string;
} {
  if (score >= 90) return { grade: "SAHIH", label: "เชื่อถือสูงสุด",
                            color: "emerald", arabic: "صحيح" };
  if (score >= 70) return { grade: "HASAN", label: "เชื่อถือได้",
                            color: "sky", arabic: "حسن" };
  if (score >= 40) return { grade: "DAIF",  label: "ต้องตรวจสอบ",
                            color: "amber", arabic: "ضعيف" };
  return { grade: "MAWDU", label: "ไม่ผ่านเกณฑ์",
           color: "red", arabic: "موضوع" };
}
```

---

## 4. Schema

```sql
-- เพิ่มฟิลด์ใน skc_users
ALTER TABLE skc_users
  ADD COLUMN trust_score INT NOT NULL DEFAULT 30,
  ADD COLUMN trust_grade TEXT NOT NULL DEFAULT 'DAIF'
    CHECK (trust_grade IN ('SAHIH','HASAN','DAIF','MAWDU')),
  ADD COLUMN trust_last_computed TIMESTAMPTZ,
  ADD COLUMN trust_approved_by TEXT REFERENCES skc_users(id);
  -- ผู้ "vouch" ให้ — chain root (staff who approved you in)

-- ตารางบันทึก trust events (audit log)
CREATE TABLE skc_trust_events (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL REFERENCES skc_users(id),
  event_type   TEXT NOT NULL,
  -- COMPLETED_JOB, NO_SHOW, DISPUTE_LOST, REVIEW_HIGH, REVIEW_LOW,
  -- LATE_SUBMIT, IDENTITY_VERIFIED, BATCH_REJECT, etc.
  delta        NUMERIC NOT NULL,    -- positive or negative
  reason       TEXT,
  job_id       TEXT REFERENCES skc_jobs(id),
  triggered_by TEXT REFERENCES skc_users(id),
  score_before NUMERIC,
  score_after  NUMERIC,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trust_events_user ON skc_trust_events(user_id, created_at DESC);
```

### SQL function — recompute trust

```sql
CREATE OR REPLACE FUNCTION fn_recompute_trust(p_user_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
  identity_score NUMERIC := 0;
  track_score NUMERIC := 0;
  chain_score NUMERIC := 0;
  social_score NUMERIC := 0;
  user_rec RECORD;
  -- ...
BEGIN
  SELECT * INTO user_rec FROM skc_users WHERE id = p_user_id;
  -- ... computes all 4 layers
  RETURN GREATEST(0, LEAST(100, identity_score + track_score + chain_score + social_score));
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 5. UI changes

### Trust Badge component

```
┌────────────────┐
│ صحيح · 95      │  ← grade label (Arabic + score)
│ เชื่อถือสูงสุด  │
└────────────────┘
```

แสดงข้าง avatar ใน:
- Job cards (ใต้ชื่อผู้จ้าง / นศ.)
- Profile pages
- Activity participants list
- Job detail (trio of actors with trust grades)
- Review forms (reviewee trust grade visible)

### Trust history page

`/profile/trust` — แสดง timeline ของ events ทั้งหมด:
- +5 COMPLETED_JOB · "ติดตั้งสายไฟ ตึก A" · 3 พ.ค.
- -3 NO_SHOW · "กิจกรรมจิตอาสา 25 พ.ค." · 25 พ.ค.
- +2 REVIEW_HIGH · จาก เสี่ยเอ (5★) · 1 มิ.ย.

ยอดสะสมเป็น **"isnad-chain history"** ของ user — เปิดดูได้ทุกคน

### Trust filter in job board

```
[All] [صحيح Sahih ≥90] [حسن Hasan ≥70] [حساس งานละเอียด]
```

---

## 6. คำถามให้หารือ

### Q1 — Initial trust score
- 🅰 **30** (Da'if) — ทุกคนเริ่มต่ำ ต้อง earn
- 🅱 50 (mid) — neutral
- 🅲 70 (Hasan) — เริ่มดี แล้วลดได้

### Q2 — Trust grade ของ role ระบบ
- คณะทำงาน มทร./ใต้ร่มฯ/อาจารย์ — เริ่มที่ระดับไหน?
- 🅰 ทุก role start เท่ากัน (เลือก Q1)
- 🅱 **staff/teacher start at HASAN (70)** — เป็น institutional trust
- 🅲 system role start at SAHIH (95)

### Q3 — Penalty severity
- NO_SHOW = -3 หรือ -5 หรือ -10?
- Dispute lost = -5 หรือ -10 หรือ -20?
- Late submission = -1 หรือ -2?

### Q4 — Visibility
- Trust score เห็นได้ทุกคน?
- 🅰 **Public** (โปร่งใส ตามหลักอิสลาม)
- 🅱 เห็นเฉพาะ staff/admin
- 🅲 Hidden score, แสดงแค่ grade

### Q5 — Auto-apply ของ Trust threshold
- เปิด feature ทันที (อาจกระทบ user เดิม)?
- 🅰 Soft launch — แสดง score เท่านั้น 1-2 เดือน · ไม่ block ยัง
- 🅱 Hard launch — apply ทันที (NO_SHOW เริ่มถูก penalty)

### Q6 — Initial assignment for existing users
- ผู้ใช้ปัจจุบันได้ score เริ่มต้น เท่ากันทุกคน?
- หรือคำนวณจาก history ที่มีอยู่ในระบบ (jobs completed, reviews, etc.) ตอนแรก?

---

## 7. ตัวอย่าง use case จริง

### Use case 1: Activity FCFS auto-approve

ปัจจุบัน: ทุก นศ. apply → auto-add (FCFS)
ใหม่: เฉพาะ Sahih + Hasan → auto · Da'if + Mawdu' → staff approve

```ts
if (registration_mode === "FCFS") {
  if (student.trust_grade in ["SAHIH", "HASAN"]) {
    // auto-add to skc_job_workers
  } else {
    // route to staff approval (existing curated flow)
  }
}
```

### Use case 2: Job creator filtering

นศ. browser → กรอง "เฉพาะผู้จ้าง trust ≥ 70" → กรองได้งานที่ไว้ใจได้

### Use case 3: Batch approval

Batch ของ staff trust 95 → fast-track approve (รองอธิการ skip)
Batch ของ staff trust 50 → ปกติต้องผ่านรองอธิการ → อธิการ

### Use case 4: Dispute decision weight

ในการตัดสิน dispute:
- น้ำหนัก vote ของ staff ตามสัดส่วน trust score
- ทุกคนยังโหวตได้ แต่ผลรวมตาม weight

---

## 8. Sprint plan (ถ้าตกลง)

### MVP (2-3 วัน)
- [ ] Migration: trust_score + trust_grade + trust_events
- [ ] `lib/trust.ts` — computeTrust() + recordEvent()
- [ ] Trigger events on:
  - job COMPLETED → +5
  - NO_SHOW → -3
  - dispute lost → -10
  - first identity layer
- [ ] TrustBadge component
- [ ] แสดงข้าง avatar ใน 3 จุดสำคัญ (jobs list, profile, review form)

### v2 (2-3 วัน)
- [ ] /profile/trust — timeline page
- [ ] Auto-apply rules (FCFS gating, etc.)
- [ ] Backfill existing users' trust from history

### v3
- [ ] Filter UI in job board
- [ ] Trust-weighted dispute resolution
- [ ] Reputation API for external apps

---

## 9. สรุป

> นำหลัก **อิสนาด** มาใช้:
> 1. ทุก user มี trust score 0-100 + grade (Sahih/Hasan/Da'if/Mawdu')
> 2. คำนวณจาก 4 layer: identity (30) · track record (40) · chain (20) · social (10)
> 3. ทุก trust event เก็บใน skc_trust_events (audit log สมบูรณ์)
> 4. กระทบ workflow: FCFS gating · dispute weight · filter · cap

ตอบ Q1-Q6 ครับ ผม implement ได้เลย — หรือถ้ามีจุดอยากปรับ design ก่อน บอกได้
