# Security

Auth, RLS, secrets, and threat model สำหรับ SkillChain RMUTL

---

## Authentication

### Tier 1 — Supabase Auth (email + password)

ใช้กับ admin / staff / teacher / employer / donor

- Provider: Supabase Auth (Postgres-backed)
- Session: JWT in HTTP-only cookie (`sb-*`)
- Password requirements: ≥ 6 chars (Supabase default — could enforce stronger)
- Refresh: automatic via middleware

### Tier 2 — Quick Session (QR + PIN)

ใช้กับ นศ. ที่ต้องการ frictionless

- Cookie: `skc-quick-session` (random 48-byte token)
- Stored: `skc_quick_sessions` table (user_id, token, expires_at)
- Duration: 7 days
- Lockout: 5 failed PIN attempts → 15 min cooldown
- PIN: bcrypt-hashed (cost factor 10)

### Why two tiers?

นศ. มักจำ password ลำบาก + ใช้มือถือเป็นหลัก
PIN 6 หลัก + QR scan = onboarding ง่ายกว่ามาก
ส่วน admin/staff ใช้ email/password เพื่อความปลอดภัยสูงขึ้น

---

## Authorization

### Role-based

```
superadmin     full access, override gov gates
admin          manage users + TRPB + wallets + system config
project_staff  approve jobs/students, distribute TRPB, release escrow
rmutl_staff    same as project_staff (RMUTL-wide)
teacher        evaluate students
employer       create jobs, pay TRPB
student        accept jobs, submit work, receive TRPB
donor          donate, view impact
```

### Per-User Permission Overrides

```
skc_user_permissions
├─ user_id
├─ permission_key  -- e.g. 'can_approve_jobs'
└─ granted         -- boolean
```

Admin grant/revoke individual permissions ที่ overrides default role permissions
ดูที่ `/admin/users/[id]` → "Permissions" tab

### API Authorization Pattern

ทุก API route ตรวจ:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401;

const { data: profile } = await supabase
  .from("skc_users")
  .select("role")
  .eq("id", user.id)
  .single();

const allowedRoles = ["admin", "project_staff"];
if (!profile || !allowedRoles.includes(profile.role)) return 403;

// Then check ownership / specific resource permission
if (resource.owner_id !== user.id && !isAdmin) return 403;
```

---

## Row-Level Security (RLS)

### Pattern

ทุก table มี RLS enabled. Common policies:

#### Read

```sql
USING (
  user_id = auth.uid()::text                    -- own data
  OR EXISTS (
    SELECT 1 FROM skc_users
    WHERE id = auth.uid()::text
      AND role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
  )
)
```

Owner เห็นของตัวเอง + staff/admin เห็นทั้งหมด

#### Write

```sql
USING (
  EXISTS (
    SELECT 1 FROM skc_users
    WHERE id = auth.uid()::text
      AND role IN ('admin', 'superadmin')
  )
)
```

เฉพาะ admin write ตรงๆ. ผ่าน SECURITY DEFINER functions สำหรับ user actions

### SECURITY DEFINER Functions

ใช้สำหรับ atomic operations ที่ต้อง bypass RLS:

```sql
CREATE FUNCTION fn_trpb_transfer(...) RETURNS UUID
AS $$ ... $$
LANGUAGE plpgsql
SECURITY DEFINER;   -- runs as function owner (postgres), not caller
```

เรียกผ่าน `supabase.rpc()` — function เช็ค business rules เอง ไม่พึ่ง RLS

### Avoiding Recursion

Common gotcha: RLS policy บน `skc_users` ที่ JOIN `skc_users` → infinite recursion

**Fix**: ใช้ helper function ที่เป็น `SECURITY DEFINER` + explicit row check:

```sql
CREATE FUNCTION public.is_admin_role() RETURNS BOOLEAN
AS $$
  SELECT EXISTS (
    SELECT 1 FROM skc_users
    WHERE id = auth.uid()::text
      AND role IN ('admin', 'superadmin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Then in RLS:
USING (user_id = auth.uid()::text OR public.is_admin_role())
```

---

## Secrets Management

### Server-only (NOT exposed to browser)

```
SUPABASE_SERVICE_ROLE_KEY      # Bypass RLS (admin)
TRON_DEPLOYER_PRIVATE_KEY      # Sign on-chain TX (treasury)
WALLET_ENCRYPTION_KEY          # Encrypt user TRON keys at rest
TELEGRAM_BOT_TOKEN             # Bot send messages
DATABASE_URL                   # Direct DB connection (Prisma)
```

ห้ามใช้ `NEXT_PUBLIC_*` prefix → แสดงในที่ client bundle = leaked

### Client-safe (NEXT_PUBLIC_*)

```
NEXT_PUBLIC_SUPABASE_URL                # Public URL
NEXT_PUBLIC_SUPABASE_ANON_KEY           # Anon key (RLS-protected)
NEXT_PUBLIC_TRON_FULL_HOST              # Public RPC URL
NEXT_PUBLIC_TRPB_TOKEN_ADDRESS          # Public contract address
NEXT_PUBLIC_JOB_ESCROW_ADDRESS          # Public contract address
```

### .env.local

ห้าม commit เข้า git
มี `.gitignore` rule แล้ว — แต่เช็คก่อน push

```bash
git status .env.local
# ต้องเป็น 'untracked' เสมอ
```

### Vercel env

- Production secrets อยู่ใน Vercel Project Settings → Environment Variables
- Encrypted at rest
- Access only by team members

---

## Input Validation

### Server-side (API routes)

ใช้ basic validation:
- Type check (Number.isFinite, typeof)
- Range check (amount > 0, amount < max)
- Format check (regex สำหรับ TRON address, email, etc.)

ตัวอย่าง:

```ts
if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
  return 400 "amount ไม่ถูกต้อง";
}

if (!/^T[A-Za-z0-9]{33}$/.test(walletAddress)) {
  return 400 "TRON address format ผิด";
}
```

### Client-side

UI validation เป็น UX อย่างเดียว — ไม่ใช่ security
ทุก action ผ่าน server เป็น source of truth

---

## Rate Limiting

ใน `src/lib/rate-limit.ts` — in-memory (Map<IP, count>)

```
RATE_LIMITS = {
  apiWrite: 30 req/min     # POST/PATCH/DELETE
  login: 5 req/min          # /api/auth/login (UI helper)
  upload: 20 req/min        # Storage upload
  pin: 5 req/15min          # PIN attempts
}
```

หา IP จาก:
1. `x-forwarded-for` (Vercel)
2. `x-real-ip` (proxy)
3. fallback `'unknown'`

Limitation: in-memory → reset ตอน Vercel cold start
Production-grade: ย้ายไป Redis / Upstash

---

## CSRF Protection

Supabase Auth ใช้ HTTP-only cookies + SameSite=Lax (default)
ทุก API route check session ก่อน → mutations ต้อง same-origin

ไม่ต้องใช้ CSRF token เพิ่ม

---

## XSS Prevention

- React escape ทุก JSX content โดย default
- `dangerouslySetInnerHTML` ไม่ใช้ในโปรเจค (grep verified)
- User input ที่แสดงใน UI: title, description, comment → render เป็น text เสมอ
- Markdown: ไม่มี user-generated markdown

---

## SQL Injection

- ทุก query ใช้ Supabase client (parameterized) หรือ Prisma
- ไม่มี raw SQL string concatenation
- SECURITY DEFINER functions ใช้ parameter placeholders ($1, $2)

---

## Storage Security

### Bucket policies

```sql
-- job-images
INSERT: TO authenticated WITH CHECK (bucket_id = 'job-images')
DELETE: USING (owner = auth.uid() OR is_admin_role())
```

User upload → owner = auth.uid() (auto)
Delete: owner only OR admin

### File validation

ตอน upload ใน `image-upload.tsx`:
- accept type: `image/*`
- size: bucket-level limit (10 MB job-images, 50 MB official-documents)
- MIME type validated server-side (Supabase storage)

### Path structure

```
job-images/<jobId>/<image_type>/<random-uuid>.<ext>
```

ทำไม `<random-uuid>` — กัน guessing + enumeration

---

## Threat Model

### Threats considered

#### T1 — Stolen Supabase anon key
- **Impact**: ใช้ anon key เรียก RLS-protected tables (limited access)
- **Mitigation**: anon key ไม่ bypass RLS → ดูได้แค่ public data
- **Action**: rotate key ถ้าเชื่อว่าหลุด

#### T2 — Stolen service_role key
- **Impact**: full DB access — disaster
- **Mitigation**: service_role อยู่ใน Vercel env (encrypted) — ไม่ commit, ไม่ส่ง client
- **Action**: rotate immediately, audit logs, force re-auth all users

#### T3 — Stolen TRON deployer key
- **Impact**: drain treasury (1M TRPB on Nile testnet — ไม่ใช่เงินจริง)
- **Mitigation**: Nile testnet only — เหรียญทดสอบ
- **Action**: deploy ใหม่ + เปลี่ยน env

#### T4 — Stolen user PIN
- **Impact**: login as user (Quick Session)
- **Mitigation**: bcrypt hash + lockout (5 wrong → 15 min) + 7-day session
- **Action**: user reset PIN ผ่าน admin

#### T5 — XSS in user content
- **Impact**: steal session, perform actions
- **Mitigation**: React auto-escape, no dangerouslySetInnerHTML
- **Status**: low risk

#### T6 — SQL injection
- **Impact**: db dump / modification
- **Mitigation**: parameterized queries, no raw SQL
- **Status**: low risk

#### T7 — Privilege escalation via permission override
- **Impact**: user gains admin powers
- **Mitigation**: เฉพาะ admin/superadmin grant overrides + audit log
- **Action**: review skc_user_permissions table periodically

#### T8 — Replay attack on QR token
- **Impact**: attacker reuse QR after seeing it
- **Mitigation**: ทุก QR + PIN combo → new session token + IP-tracked attempts
- **Status**: medium — could improve with short-lived QR (5-min) instead of permanent

#### T9 — RLS misconfiguration
- **Impact**: cross-user data leak
- **Mitigation**: explicit RLS testing per table + integration tests
- **Action**: run `manual_rls_policies.sql` properly + verify with test users

#### T10 — Vercel environment leak
- **Impact**: secrets exposed
- **Mitigation**: Vercel encrypts env at rest + only team members access
- **Action**: enable Vercel SSO + audit log

### Threats NOT in scope

- DDoS protection beyond Vercel default
- Advanced CSRF (using cookies + SameSite + HTTPS)
- WAF/IDS — depends on infrastructure
- Multi-factor authentication (TODO for production)

---

## PDPA Compliance

ระบบเก็บข้อมูลส่วนบุคคล:
- ชื่อ-อีเมล
- TRON wallet address (optional)
- รูปโปรไฟล์
- ผลงาน + คะแนน

### User rights

- **Right to access**: `/profile` shows all own data
- **Right to deletion**: admin can delete user account → cascade deletes
- **Right to portability**: TODO — export ผ่าน API
- **Consent log**: `skc_pdpa_consents` (ดู `manual_qr_pdpa.sql`)

### Data retention

- Active users: kept indefinitely
- Inactive > 1 year: TBD policy
- Deleted users: anonymize personal fields แล้วเก็บ audit trail

---

## Audit Trail

Every important action logs to:

| Table | What |
|---|---|
| `skc_behavior_logs` | User actions (login, sensitive ops) |
| `skc_gov_workflow_log` | Government workflow state changes |
| `skc_trpb_transactions` | Every TRPB movement |
| `skc_credit_transactions` | Every SkillCredit award/revoke |
| `skc_notifications` | Notifications sent (also serves as audit) |

Admin can review at `/admin/reports` (TBD UI for full log explorer)

---

## Disclosure / Reporting

หาก discovered vulnerability — ติดต่อ:
- worrajak@rmutl.ac.th (lead developer)
- หรือเปิด GitHub Issue (private security advisory)

ไม่ public disclose จนกว่าจะมี patch แล้ว 30 วัน

---

## Future Improvements

- [ ] Multi-factor authentication (TOTP for admin)
- [ ] Redis-backed rate limiting (better than in-memory)
- [ ] Sentry / external error tracking
- [ ] Penetration test before public launch
- [ ] Security audit by 3rd party
- [ ] Bug bounty program
- [ ] CSP headers (Content Security Policy)
- [ ] HSTS headers
- [ ] Subresource Integrity (SRI) สำหรับ external scripts

---

## Related Docs

- [architecture.md](architecture.md) — System design
- [API_REFERENCE.md](API_REFERENCE.md) — API surfaces
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production setup
