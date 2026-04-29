# API Reference

รายการ API endpoints ทั้งหมดในระบบ จัดกลุ่มตามฟีเจอร์

ทุก endpoint require authentication (Supabase auth หรือ Quick Session) ยกเว้นที่ระบุว่า `public`

---

## Auth & User

| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/api/auth/login` | Rate-limit check (UI helper) | public |
| POST | `/api/auth/wallet` | Bind / generate TRON wallet | authenticated |
| POST | `/api/quick-auth/login` | QR + PIN login → set session cookie | public |
| POST | `/api/quick-auth/qr` | Generate QR token for user | admin |
| POST | `/api/quick-auth/pin` | Set / change PIN | authenticated |
| GET | `/api/users/[id]` | User profile | authenticated |
| POST | `/api/users/[id]/approve` | Approve user signup | admin/staff |
| GET | `/api/invitations/[token]` | Validate invitation | public |

---

## Jobs

### CRUD + Lifecycle

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/jobs` | List jobs (filter by status, type, etc.) | authenticated |
| POST | `/api/jobs` | Create job | employer/admin/staff |
| GET | `/api/jobs/[id]` | Job details | authenticated |
| PATCH | `/api/jobs/[id]` | Update job (whitelist fields, status transitions) | owner/staff |
| DELETE | `/api/jobs/[id]` | Delete job (rules-based) | owner/admin |
| POST | `/api/jobs/[id]/review-job` | Staff review (PENDING_REVIEW → OPEN/CANCELLED) | staff |
| POST | `/api/jobs/[id]/approve` | Approve student assignment request | staff |
| POST | `/api/jobs/[id]/cancel` | Cancel job (with reason) | owner/staff |
| POST | `/api/jobs/[id]/schedule` | Propose work dates (ASSIGNED) | employer/student |
| PATCH | `/api/jobs/[id]/schedule` | Confirm date → IN_PROGRESS | other party |
| POST | `/api/jobs/[id]/submit` | Student submits work (CONFIRMED/IN_PROGRESS → SUBMITTED) | student |
| POST | `/api/jobs/[id]/confirm-completion` | Confirm work done (staff or employer) | staff/employer |
| POST | `/api/jobs/[id]/safety-check` | Safety verification | staff |

### Escrow + Payment

| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/api/jobs/[id]/release-escrow` | Release TRPB → student (ledger) | staff/admin |
| POST | `/api/jobs/[id]/record-payment` | Record TX hash (legacy on-chain mirror) | employer |
| GET | `/api/jobs/[id]/qr` | Get QR token for job | authenticated |

### Smart QR Resolver

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/qr-resolve/[token]` | Resolve QR → target URL by role + status | public |
| GET | `/api/checkin/qr` | QR check-in token | authenticated |

---

## Reviews

| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/api/reviews` | Create review (employer/student/mentor + eval_phase) | role-specific |
| GET | `/api/reviews` | List reviews by type | authenticated |
| GET | `/api/reviews/check` | Check if user already reviewed (job + phase) | authenticated |

### POST `/api/reviews` body

```json
{
  "type": "employer" | "student" | "mentor",
  "job_id": "...",
  "eval_phase": "PRE_WORK" | "IN_PROGRESS" | "POST_WORK",
  "comment": "...",

  // type=employer (rates student):
  "student_id": "...",
  "score_quality": 1-5,
  "score_punctuality": 1-5,
  "score_attitude": 1-5,

  // type=student (rates employer):
  "employer_id": "...",
  "score_clarity": 1-5,
  "score_payment": 1-5,
  "score_safety": 1-5,

  // type=mentor (rates trainee):
  "trainee_id": "...",
  "score_effort": 1-4,
  "score_safety": 1-4,
  "score_skill_dev": 1-4,
  "recommend_promotion": true | false
}
```

Response:
- `201` + review row on success
- `409 { already_reviewed: true, existing }` on duplicate (instead of 23505)
- `403` if role/status check fails

---

## TRPB Ledger

### Admin endpoints (`role IN ('admin', 'superadmin')`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/trpb` | Pool stats + balances + recent transactions |
| POST | `/api/admin/trpb/mint` | Mint from SYSTEM pool → user |
| GET | `/api/admin/wallets` | List users + wallet + balance |
| PATCH | `/api/admin/wallets` | Set/update/clear wallet_address |

### Staff/Admin endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/trpb/transfer` | User → user transfer (cap 100k) |
| GET | `/api/trpb/staff-overview` | Staff's own balance + employer list + tx |

### Authenticated user endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/trpb/balance` | Own balance + recent transactions |

### POST `/api/admin/trpb/mint` body

```json
{
  "to_user_id": "...",
  "amount": 5000,
  "reason": "ทดสอบระบบ"
}
```

### POST `/api/trpb/transfer` body

```json
{
  "to_user_id": "...",
  "amount": 5000,
  "reason": "โควต้าโครงการ Phase 1"
}
```

### PATCH `/api/admin/wallets` body

```json
{
  "user_id": "...",
  "wallet_address": "TU7VbE..." | null   // null = unbind
}
```

Validation: `^T[A-Za-z0-9]{33}$` + uniqueness check

---

## Government Workflow (Optional)

### Activity Approvals

| Method | Path | Description |
|---|---|---|
| POST | `/api/gov/activity-approvals` | Create activity (staff submits) |
| GET | `/api/gov/activity-approvals` | List activities |
| POST | `/api/gov/activity-approvals/[id]/approve` | Approve activity |
| POST | `/api/gov/activity-approvals/[id]/generate-doc` | Generate DOCX |

### Disbursements

| Method | Path | Description |
|---|---|---|
| POST | `/api/gov/disbursements` | Create disbursement |
| GET | `/api/gov/disbursements` | List disbursements |
| POST | `/api/gov/disbursements/[id]/approve` | Approve disbursement |
| POST | `/api/gov/disbursements/[id]/pay` | Mark as paid |

### Work Certifications

| Method | Path | Description |
|---|---|---|
| POST | `/api/gov/work-certifications` | Create cert (auto on completion) |
| GET | `/api/gov/work-certifications` | List certs |

---

## SkillCredit

| Method | Path | Description |
|---|---|---|
| GET | `/api/skill-credits/balance` | Own SkillCredit balance + level |
| GET | `/api/skill-credits/leaderboard` | Top earners |
| POST | `/api/skill-credits/award` | Manual award (admin) |

---

## Warranty + Disputes

| Method | Path | Description | Roles |
|---|---|---|---|
| POST | `/api/warranty-claims` | Open warranty claim | employer |
| PATCH | `/api/warranty-claims/[id]` | Resolve claim | staff |
| POST | `/api/disputes` | Open dispute | any party |
| PATCH | `/api/disputes/[id]` | Resolve dispute | staff/admin |

---

## Notifications

| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | Own notifications (paginated) |
| PATCH | `/api/notifications/[id]/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |
| POST | `/api/telegram/link` | Link Telegram chat_id |
| POST | `/api/telegram/webhook` | Bot webhook (Telegram → server) |

---

## Training

| Method | Path | Description |
|---|---|---|
| GET | `/api/training` | List courses |
| POST | `/api/training` | Create course (instructor/staff) |
| POST | `/api/training/[id]/enroll` | Enroll in course |
| POST | `/api/training/[id]/complete` | Mark complete + award SC |

---

## Rate Limiting

ทุก endpoint ที่ write data ใช้ rate limit (in-memory):

```ts
RATE_LIMITS = {
  apiWrite: { maxRequests: 30, windowMs: 60_000 },  // 30 req/min
  login: { maxRequests: 5, windowMs: 60_000 },      // 5 req/min
  upload: { maxRequests: 20, windowMs: 60_000 },    // 20 req/min
}
```

Identified by IP address. Returns `429 ส่งคำขอบ่อยเกินไป` if exceeded.

---

## Error Format

ทุก error response ใช้ format นี้:

```json
{
  "error": "ข้อความภาษาไทย",
  "hint": "คำแนะนำเพิ่มเติม (optional)",
  "code": "POSTGRES_ERROR_CODE (optional)",
  "currentGovStatus": "DRAFT (optional, gov gates)"
}
```

Status codes:
- `200` — success
- `201` — created
- `400` — validation error
- `401` — unauthorized
- `403` — forbidden (role/status check fail)
- `404` — not found
- `409` — conflict (duplicate review, wallet collision, etc.)
- `429` — rate limit
- `500` — server error

---

## Postgres Function RPC (via supabase.rpc)

จาก lib/trpb-ledger.ts:

```ts
supabase.rpc('fn_trpb_transfer', {
  p_from: '...',  p_to: '...',  p_amount: 100,
  p_tx_type: 'TRANSFER',  p_job_id: null,
  p_reason: '...',  p_created_by: '...',
  p_on_chain_ref: null,
})
```

ฟังก์ชันที่ใช้บ่อย:
- `fn_trpb_transfer` — generic transfer
- `fn_trpb_escrow_hold` — move balance → hold
- `fn_trpb_escrow_release` — hold → recipient
- `fn_init_trpb_balance` — auto-trigger สร้าง balance row

---

## Related Docs

- [USER_GUIDE_TH.md](USER_GUIDE_TH.md) — คู่มือผู้ใช้
- [architecture.md](architecture.md) — System architecture
- [SECURITY.md](SECURITY.md) — Auth + RLS
