# Architecture

ภาพรวมระบบ + state machines + data flow

---

## High-level Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Users (Browser)                          │
│   Admin · Project Staff · Employer · Student · Teacher · Donor   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                  HTTPS / Vercel Edge
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                     Next.js 16 Application                       │
│  Server Components · Client Components · API Routes              │
│                                                                   │
│  Authentication: Supabase Auth + Quick Session (cookies)         │
│  Middleware: src/middleware.ts (route protection)                │
└──────────────────────────┬───────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
┌─────────────▼──────────┐   ┌─────────▼─────────────────┐
│  Supabase (Postgres)   │   │  TRON Nile (mirror only)  │
│  - skc_* tables        │   │  - TRPB Token contract    │
│  - SQL functions       │   │  - Job Escrow contract    │
│  - Row-level security  │   │  - Treasury wallet (1M)   │
│  - Storage buckets     │   │                            │
│  - Auth                │   │  (NOT called automatically)│
└────────────────────────┘   └───────────────────────────┘
              │
              ▼
       Telegram Bot
       (notifications)
```

---

## Authentication Tiers

ระบบมี 2 tiers ของ auth ทำงานคู่กัน:

### Tier 1 — Quick Session (QR + PIN)

สำหรับ นศ. ที่ต้องการ frictionless login

- Cookie: `skc-quick-session` (7 วัน)
- Tables: `skc_user_pins`, `skc_user_qr_tokens`, `skc_quick_sessions`
- Flow:
  1. Admin generate QR token + นศ. ตั้ง PIN
  2. นศ. scan QR → ระบบขอ PIN
  3. PIN ถูก → set cookie 7 วัน
- Lockout: 5 ครั้งผิด → block 15 นาที

### Tier 2 — Supabase Auth (email + password)

สำหรับ admin, staff, teacher, employer, donor

- Cookie: Supabase `sb-*`
- Login: `/login` → `signInWithPassword()` → role-based redirect
- Session: managed by Supabase (default 1 ชม., refreshable)

### Middleware Logic

```ts
// src/middleware.ts → src/lib/supabase/middleware.ts
const isAuthenticated = !!supabaseUser || !!quickSession;
if (!isAuthenticated && !isPublicRoute) {
  redirect to /quick-login?next=<currentPath>
}
```

Public routes: `/`, `/login`, `/quick-login`, `/register*`, `/jobs/*`, `/training/*`, `/verify/*`, `/invite/*`, `/j/*`

---

## Job Lifecycle State Machine

```
                ┌──────────────────┐
                │ PENDING_REVIEW   │ employer สร้างงาน
                └────────┬─────────┘
                  staff approve / reject
                ┌────────┴─────────┐
                │       OPEN       │ เปิดรับสมัคร
                └────────┬─────────┘
                  นศ. ส่งคำขอ → staff อนุมัติ
                ┌────────┴─────────┐
                │     ASSIGNED     │ มอบหมายแล้ว
                └────────┬─────────┘
                  ทั้ง 2 ฝ่ายนัดวัน + ยืนยัน
                ┌────────┴─────────┐
                │    CONFIRMED     │ (optional state)
                └────────┬─────────┘
                  นศ. เริ่มงาน
                ┌────────┴─────────┐
                │   IN_PROGRESS    │ กำลังทำ + อัพรูป
                └────────┬─────────┘
                  นศ. ส่งงาน (มีรูปงานเสร็จ)
                ┌────────┴─────────┐
                │    SUBMITTED     │ รอ 2 ฝ่ายยืนยัน
                └────────┬─────────┘
                  staff_confirmed + employer_confirmed
                ┌────────┴─────────┐
                │    COMPLETED     │ เสร็จสมบูรณ์
                └────────┬─────────┘
                  staff release escrow
                ┌────────┴─────────┐
                │  IN_WARRANTY     │ ประกัน 7 วัน
                └────────┬─────────┘
                  ผ่าน 7 วัน หรือ admin ปิด
                ┌────────┴─────────┐
                │     CLOSED       │ ปิดถาวร
                └──────────────────┘

ทุก state สามารถ → CANCELLED ได้ (admin/staff)
SUBMITTED → DISPUTED ถ้ามีปัญหา
```

### ใครทำอะไรในแต่ละ stage

| Stage | คนที่ act | ทำอะไร |
|---|---|---|
| PENDING_REVIEW | project_staff | review job → APPROVE/REJECT (เปลี่ยน OPEN/CANCELLED) |
| OPEN | นศ. | ส่ง assignment request |
| OPEN→ASSIGNED | project_staff | approve assignment_request |
| ASSIGNED | employer + นศ. | นัดวันทำงาน (POST /api/jobs/[id]/schedule) |
| ASSIGNED→IN_PROGRESS | other party | confirm proposed date (PATCH /schedule) |
| IN_PROGRESS | นศ. | upload progress + completion images |
| IN_PROGRESS→SUBMITTED | นศ. | กดส่งมอบงาน (POST /api/jobs/[id]/submit) |
| SUBMITTED | staff supervisor + employer | กด "ยืนยันงานเสร็จ" |
| SUBMITTED→COMPLETED | (auto) | เมื่อทั้ง 2 ฝ่ายยืนยัน |
| COMPLETED | staff supervisor | release escrow → TRPB ไป นศ. |
| COMPLETED→IN_WARRANTY | (auto trigger) | หลัง release |
| IN_WARRANTY→CLOSED | (auto หลัง 7 วัน) | หรือ admin manual |

---

## TRPB Off-chain Ledger

### Schema

```
skc_trpb_balances
├─ user_id     TEXT PK    -- '__SYSTEM__' for pool
├─ balance     NUMERIC    -- spendable
├─ hold_balance NUMERIC   -- locked in escrow
└─ updated_at  TIMESTAMPTZ

skc_trpb_transactions (audit trail)
├─ id          UUID PK
├─ from_user   TEXT       -- nullable for MINT
├─ to_user     TEXT       -- nullable for HOLD/BURN
├─ amount      NUMERIC
├─ tx_type     ENUM       -- MINT/TRANSFER/ESCROW_HOLD/ESCROW_RELEASE/ESCROW_REFUND/BURN
├─ job_id      TEXT       -- optional FK to skc_jobs
├─ reason      TEXT
├─ on_chain_ref TEXT      -- optional Nile TX hash for mirror
├─ created_by  TEXT
└─ created_at  TIMESTAMPTZ
```

### Helper SQL Functions

```
fn_trpb_transfer(p_from, p_to, p_amount, p_tx_type, p_job_id?, p_reason?, p_created_by?, p_on_chain_ref?)
fn_trpb_escrow_hold(p_holder, p_amount, p_job_id, p_created_by)
fn_trpb_escrow_release(p_holder, p_recipient, p_amount, p_job_id, p_created_by)
```

ทุก function ใช้ `SECURITY DEFINER` + atomic (wrap in transaction implicitly)

### Token Flow

```
┌────────────────────────┐
│  SYSTEM Pool (1M)      │
└───────────┬────────────┘
            │ admin mint (POST /api/admin/trpb/mint)
            ▼
┌────────────────────────┐
│  project_staff (โควต้า) │
└───────────┬────────────┘
            │ staff transfer (POST /api/trpb/transfer)
            ▼
┌────────────────────────┐
│  employer              │
└───────────┬────────────┘
            │ escrow_hold (auto on release)
            ▼
┌────────────────────────┐
│  HOLD (in escrow)      │
└───────────┬────────────┘
            │ escrow_release (POST /api/jobs/[id]/release-escrow)
            ▼
┌────────────────────────┐
│  student (ค่าจ้าง)      │
└────────────────────────┘
```

### Auto Top-up (pilot mode)

ถ้า employer balance ไม่พอตอน release escrow:
1. คำนวณ `needed = amount - hold_balance`
2. ถ้า `balance < needed` → mint จาก SYSTEM ให้ employer
3. แล้ว hold + release

ปิดได้โดยลบ logic ใน `/api/jobs/[id]/release-escrow/route.ts`

---

## Review System (eval_phase)

3 phases ตาม schema:
- `PRE_WORK` — ก่อนเริ่มงาน (ยังไม่ใช้)
- `IN_PROGRESS` — interim review (ใช้แล้ว)
- `POST_WORK` — final review (default)

### Allowed Status per Phase

```
PRE_WORK:    ASSIGNED / CONFIRMED
IN_PROGRESS: IN_PROGRESS only
POST_WORK:   SUBMITTED / COMPLETED / IN_WARRANTY / CLOSED
```

### Unique Constraint

```sql
UNIQUE (job_id, employer_id, student_id, eval_phase)  -- skc_employer_reviews
UNIQUE (job_id, student_id, employer_id, eval_phase)  -- skc_student_reviews
```

แต่ละ user สามารถประเมินงานเดียวกันได้ 2 รอบ — IN_PROGRESS และ POST_WORK

### Form Behavior

```ts
// On mount
GET /api/reviews/check?type=...&job_id=...&eval_phase=...
  → returns existing review or null

// If existing:
  render "✅ ประเมินแล้ว" card with score circle
// If null:
  render form with star rating

// On submit, if 23505 unique violation:
  re-fetch existing → render "✅ ประเมินแล้ว" card
```

---

## Government Workflow (Optional)

ระบบเอกสารราชการคู่ขนานกับ blockchain track

### Tables

```
skc_gov_projects         -- โครงการแม่ปีงบประมาณ
skc_activity_approvals   -- บันทึกขออนุมัติกิจกรรม
skc_work_certifications  -- ใบรับรองการปฏิบัติงาน
skc_disbursements        -- ใบเบิกค่าตอบแทน
skc_official_documents   -- เก็บไฟล์ DOCX ที่ generate
skc_gov_workflow_log     -- audit trail
```

### Gov Status Flow

```
DRAFT → ACTIVITY_APPROVAL_PENDING → ACTIVITY_APPROVED →
CONTRACT_PENDING → CONTRACT_SIGNED → IN_PROGRESS →
WORK_CERTIFIED → DISBURSEMENT_PENDING → DISBURSEMENT_APPROVED →
PAID → COMPLETED
```

### Pilot Mode (Disabled by Default)

`ENFORCE_GOV_GATE=false` (default) ใน env
- App layer: `checkCanAssign()` + `checkCanReleaseEscrow()` → return `{ allowed: true }` ทันที
- DB layer: `fn_job_gate_check_assignment()` + `fn_job_gate_check_escrow_release()` = no-op (ผ่าน `manual_disable_gov_gates.sql`)

เปิด enforcement:
1. Set env: `ENFORCE_GOV_GATE=true`
2. Re-run gate functions จาก `manual_fix_job_trigger.sql`

---

## Storage Buckets

| Bucket | Public? | ขนาด | MIME types | ใช้กับ |
|---|---|---|---|---|
| `job-images` | public | 10 MB | jpeg/png/webp/gif | รูปงาน (job/progress/completion) |
| `official-documents` | public | 50 MB | docx/pdf/doc | เอกสารราชการ |
| `avatars` | public | 5 MB | jpeg/png/webp | Profile pictures |

### RLS

```sql
-- job-images
SELECT: bucket_id = 'job-images' (public)
INSERT: TO authenticated WITH CHECK (bucket_id = 'job-images')
DELETE: owner = auth.uid() OR is_admin_role()
```

---

## Schema — Key Tables

```
skc_users                   -- All users (role, name, email, wallet_address)
skc_jobs                    -- Job lifecycle + gov_status
skc_job_assignment_requests -- นศ. ส่งคำขอรับงาน
skc_job_images              -- รูปแต่ละขั้น (job/progress/completion)
skc_job_chat_rooms          -- Chat ระหว่าง employer + นศ.

skc_employer_reviews        -- review form ผู้จ้าง→นศ. (3 criteria)
skc_student_reviews         -- review form นศ.→ผู้จ้าง (3 criteria)
skc_mentor_reviews          -- review form mentor→trainee (4 rubric)

skc_trpb_balances           -- TRPB ledger balance
skc_trpb_transactions       -- TRPB ledger audit trail
skc_credit_balances         -- SkillCredit (soul-bound)
skc_credit_transactions     -- SkillCredit audit

skc_user_permissions        -- per-user permission overrides
skc_notifications           -- in-app notifications
skc_telegram_links          -- chat_id binding for bot

skc_warranty_claims         -- warranty claim tickets
skc_disputes                -- dispute tickets

skc_activity_approvals      -- gov: บันทึกขออนุมัติ
skc_work_certifications     -- gov: ใบรับรอง
skc_disbursements           -- gov: ใบเบิก
skc_official_documents      -- gov: DOCX files

skc_training_courses        -- หลักสูตรอบรม
skc_training_enrollments    -- การลงทะเบียน
```

---

## Critical Triggers

| Trigger | ตาราง | เมื่อ | ทำอะไร |
|---|---|---|---|
| `trg_init_trpb_balance` | skc_users | INSERT | สร้าง balance row = 0 |
| `trg_recalc_skill_level` | skc_credit_balances | UPDATE | คำนวณ level จาก lifetime_earned |
| `trg_skc_jobs_updated_at` | skc_jobs | UPDATE | auto update `updated_at` |
| `fn_job_created_create_activity_approval` | skc_jobs | INSERT | สร้าง gov activity DRAFT (defensive) |
| `fn_job_completed_create_work_cert` | skc_jobs | UPDATE (both confirms) | สร้าง work_certification DRAFT |
| `fn_start_warranty` | skc_jobs | UPDATE→COMPLETED | start warranty 7 days |

---

## RLS Pattern

ทุก table มี RLS enabled

```sql
-- Read: owner OR staff
USING (
  user_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM skc_users
    WHERE id = auth.uid()::text
    AND role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
  )
)

-- Write: admin only (or via SECURITY DEFINER function)
USING (
  EXISTS (
    SELECT 1 FROM skc_users
    WHERE id = auth.uid()::text
    AND role IN ('admin', 'superadmin')
  )
)
```

ดู [SECURITY.md](SECURITY.md) สำหรับรายละเอียด

---

## Related Docs

- [USER_GUIDE_TH.md](USER_GUIDE_TH.md) — คู่มือผู้ใช้
- [API_REFERENCE.md](API_REFERENCE.md) — API endpoints
- [MIGRATIONS.md](MIGRATIONS.md) — SQL setup checklist
- [SECURITY.md](SECURITY.md) — Auth + RLS + secrets
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deploy
