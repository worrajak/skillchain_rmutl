# Database Migrations

ลำดับการรัน SQL migrations สำหรับ setup โปรเจคใหม่ หรือ recovery หลัง DB reset

ไฟล์ migrations อยู่ใน [`prisma/migrations/`](../prisma/migrations/)

---

## วิธีรัน

ทุกไฟล์รันผ่าน **Supabase Dashboard → SQL Editor → New query → Paste → Run**

> **อย่าใช้ `npx prisma db push`** — จะเขียนทับ schema ที่ปรับมือแล้วเสีย

---

## Setup ใหม่ (DB เปล่า)

รันตามลำดับนี้:

### Phase 1: Core Schema

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 1 | `manual_schema_drift_fix.sql` | สร้าง core tables (User, Job, etc.) |
| 2 | `manual_schema_drift_fix_v2.sql` | Fix ที่ตามมาหลัง v1 |
| 3 | `manual_skc_rls_open.sql` | RLS policies เริ่มต้น (open mode) |

### Phase 2: ID + Timestamp Defaults

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 4 | `manual_fix_id_defaults.sql` | `DEFAULT gen_random_uuid()::text` ให้ทุก table |
| 5 | `manual_fix_timestamp_defaults.sql` | `DEFAULT NOW()` + auto-update trigger |
| 6 | `manual_fix_missing_columns.sql` | เพิ่ม columns ที่ขาด |

### Phase 3: Job + Lifecycle

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 7 | `manual_fix_pending_review_enum.sql` | เพิ่ม `PENDING_REVIEW` enum |
| 8 | `manual_job_review.sql` | Columns รีวิวงาน (legacy — overwritten by 9) |
| 9 | `manual_job_review_columns_fix.sql` | **Fix** ใช้ TEXT แทน UUID |
| 10 | `manual_add_job_assignment_requests.sql` | ตาราง assignment requests |
| 11 | `manual_warranty_system.sql` | Warranty 7 วัน + claims |
| 12 | `manual_fix_job_trigger.sql` | Defensive triggers (skip on error) |

### Phase 4: Permissions + Auth

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 13 | `manual_permissions.sql` | Role + per-user permission overrides |
| 14 | `manual_avatar_url.sql` | Avatar storage |
| 15 | `manual_qr_quick_auth.sql` | QR + PIN auth (Tier 1) |
| 16 | `manual_qr_pdpa.sql` | PDPA consent tracking |

### Phase 5: Storage Buckets

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 17 | `manual_job_images_and_quota.sql` | Job images table + employer quota |
| 18 | `manual_fix_job_images.sql` | **Fix** TEXT id + bucket creation |
| 19 | `manual_official_documents_bucket.sql` | Bucket สำหรับ DOCX ราชการ |

### Phase 6: Government Workflow

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 20 | `manual_government_workflow.sql` | Tables: activities, certifications, disbursements |
| 21 | `manual_government_workflow_triggers.sql` | Triggers ผูก job ↔ gov_status |
| 22 | `manual_disable_gov_gates.sql` | **Pilot mode**: ปิด gov gates |

### Phase 7: SkillCredit + Telegram

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 23 | `manual_skill_credits.sql` | Skill Credit + level system |
| 24 | `manual_training_system.sql` | หลักสูตรอบรม |
| 25 | `manual_telegram.sql` | Telegram bot integration |

### Phase 8: Reviews — Eval Phase

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 26 | `manual_review_eval_phase.sql` | Unique constraint รวม `eval_phase` |

### Phase 9: TRPB Off-chain Ledger

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 27 | `manual_trpb_offchain_ledger.sql` | TRPB pool + transactions + functions |
| 28 (recovery) | `manual_trpb_recovery.sql` | **ใช้แทน 27** ถ้าครั้งแรกรัน partial fail |

### Phase 10: RLS (final)

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 29 | `manual_rls_policies.sql` | Production-grade RLS policies |

---

## หลังรัน DB Reset (สั้นๆ)

ถ้า DB ถูก reset และข้อมูลหาย:

```sql
-- รันตามลำดับใน Supabase SQL Editor:
1. manual_schema_drift_fix_v2.sql
2. manual_fix_id_defaults.sql + manual_fix_timestamp_defaults.sql
3. manual_fix_pending_review_enum.sql
4. manual_job_review_columns_fix.sql
5. manual_warranty_system.sql
6. manual_fix_job_trigger.sql
7. manual_qr_quick_auth.sql
8. manual_fix_job_images.sql (สร้าง bucket job-images)
9. manual_official_documents_bucket.sql
10. manual_disable_gov_gates.sql
11. manual_skill_credits.sql
12. manual_review_eval_phase.sql
13. manual_trpb_recovery.sql ← idempotent, รวม seed pool 1M
14. manual_telegram.sql
```

---

## Verify หลังรันเสร็จ

รัน query นี้ใน SQL Editor:

```sql
-- ตรวจ tables
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name LIKE 'skc_%'
 ORDER BY table_name;

-- ตรวจ enums
SELECT typname FROM pg_type WHERE typcategory = 'E' ORDER BY typname;

-- ตรวจ TRPB pool (ต้อง = 1,000,000)
SELECT user_id, balance FROM skc_trpb_balances WHERE user_id = '__SYSTEM__';

-- ตรวจ functions
SELECT proname FROM pg_proc
 WHERE proname LIKE 'fn_trpb%' OR proname LIKE 'fn_job_%'
 ORDER BY proname;

-- ตรวจ buckets
SELECT id, public FROM storage.buckets;
-- expected: job-images, official-documents
```

---

## ปัญหาที่เจอบ่อย + ทางแก้

### "function fn_trpb_transfer not found in schema cache"

PostgREST cache ไม่ refresh หลังสร้าง function

```sql
NOTIFY pgrst, 'reload schema';
```

หรือรัน `manual_trpb_recovery.sql` ที่มี NOTIFY อยู่ท้ายไฟล์

### "relation skc_trpb_balances does not exist"

Migration ไม่ได้รัน หรือ partial fail → รัน `manual_trpb_recovery.sql`

### "Could not find the 'review_note' column of skc_jobs"

Column ขาด หรือ type mismatch (UUID vs TEXT)
→ รัน `manual_job_review_columns_fix.sql`

### Job creation ติด gov gate

→ รัน `manual_disable_gov_gates.sql` (pilot mode)

### Image upload 404 บน skc_job_images

Table หรือ bucket ขาด → รัน `manual_fix_job_images.sql`

### Review ครั้งที่ 2 บอก "key ซ้ำ"

Unique constraint ไม่รวม `eval_phase`
→ รัน `manual_review_eval_phase.sql`

---

## Migration Files Reference

โครงสร้าง: `prisma/migrations/manual_<feature>.sql`

| ไฟล์ | เพิ่งสร้าง? | Idempotent? | Reset-safe? |
|---|---|---|---|
| `manual_schema_drift_fix*.sql` | — | partial | ✅ |
| `manual_fix_id_defaults.sql` | — | ✅ | ✅ |
| `manual_fix_timestamp_defaults.sql` | — | ✅ | ✅ |
| `manual_fix_missing_columns.sql` | — | ✅ | ✅ |
| `manual_fix_pending_review_enum.sql` | — | ✅ | ✅ |
| `manual_job_review_columns_fix.sql` | ✅ | ✅ | ✅ |
| `manual_add_job_assignment_requests.sql` | — | ✅ | ✅ |
| `manual_warranty_system.sql` | — | ✅ | ✅ |
| `manual_fix_job_trigger.sql` | — | ✅ | ✅ |
| `manual_permissions.sql` | — | partial | ✅ |
| `manual_avatar_url.sql` | — | ✅ | ✅ |
| `manual_qr_quick_auth.sql` | — | ✅ | ✅ |
| `manual_qr_pdpa.sql` | — | ✅ | ✅ |
| `manual_job_images_and_quota.sql` | — | partial | ✅ |
| `manual_fix_job_images.sql` | — | ✅ | ✅ |
| `manual_official_documents_bucket.sql` | ✅ | ✅ | ✅ |
| `manual_government_workflow.sql` | — | partial | ✅ |
| `manual_government_workflow_triggers.sql` | — | partial | ✅ |
| `manual_disable_gov_gates.sql` | ✅ | ✅ | ✅ |
| `manual_skill_credits.sql` | — | partial | ✅ |
| `manual_training_system.sql` | — | partial | ✅ |
| `manual_telegram.sql` | — | partial | ✅ |
| `manual_review_eval_phase.sql` | ✅ | ✅ | ✅ |
| `manual_trpb_offchain_ledger.sql` | ✅ | partial | ⚠️ |
| `manual_trpb_recovery.sql` | ✅ | ✅ | ✅ |
| `manual_rls_policies.sql` | — | ✅ | ✅ |

**Idempotent** = รันซ้ำได้ปลอดภัย
**Reset-safe** = รันหลัง DB reset ได้

⚠️ `manual_trpb_offchain_ledger.sql` ตัวเก่ามี diagnostic ที่ reference table ก่อนสร้าง → ใช้ `manual_trpb_recovery.sql` แทน
