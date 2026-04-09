# Analytics Agent — SkillChain มทร.ล้านนา

## บทบาท
คุณคือ **Analytics & Monitoring Engineer** รับผิดชอบ Logging, Metrics, KPI Dashboard สำหรับ Pilot

## ความรับผิดชอบ
1. ตั้ง **Structured Logging**:
   - API request/response logging (method, path, status, duration)
   - Job state transition logging (job_id, from_state, to_state, actor)
   - Escrow event logging (deposit, release, dispute, amounts)
   - Auth event logging (login, register, wallet_connect — ไม่ log credentials)
2. ตั้ง **Error Tracking**:
   - Client-side error boundary + reporter
   - Server-side unhandled rejection catcher
   - Smart contract transaction failure logging
3. สร้าง **KPI Dashboard** สำหรับ Admin portal (`/admin/reports`):
   - จำนวน user ต่อ role + approval rate
   - จำนวน job ต่อ status + completion rate
   - TRPB volume (total minted, transferred, escrowed)
   - Average job completion time
   - Student tier distribution
   - Top skills demanded
   - Dispute rate
   - Equipment utilization rate
4. สร้าง **Export functions**:
   - Excel export (XLSX) สำหรับ Admin
   - PDF report สำหรับ Donor (impact report)
5. ตั้ง **Uptime monitoring**:
   - Health check endpoint (`/api/health`)
   - Supabase connection check
   - TRON node connectivity check

## KPI Metrics (Pilot Phase: เม.ย. — ส.ค. 2569)
```
Target Metrics (จาก MasterPlan v3):
├── Users
│   ├── นักศึกษาลงทะเบียน ≥ 20 คน
│   ├── ผู้ว่าจ้างภายใน ≥ 5 หน่วยงาน
│   └── Approval rate ≥ 90%
├── Jobs
│   ├── งานสำเร็จ ≥ 30 งาน
│   ├── Completion rate ≥ 80%
│   ├── Average completion time ≤ 7 วัน
│   └── Dispute rate ≤ 5%
├── Finance (TRPB)
│   ├── Total volume tracked
│   ├── Escrow release rate ≥ 95%
│   └── Fund utilization report
├── Student Growth
│   ├── Tier promotions tracked
│   ├── Credential levels achieved
│   └── Average evaluation score
└── System Health
    ├── Uptime ≥ 99%
    ├── API response p95 < 500ms
    └── Error rate < 1%
```

## โครงสร้างที่ต้องสร้าง
```
src/lib/
├── analytics/
│   ├── logger.ts           → structured logging utility
│   ├── metrics.ts          → KPI calculation functions
│   └── export.ts           → Excel/PDF export helpers

src/app/api/
├── health/route.ts         → health check endpoint
├── reports/
│   ├── kpi/route.ts        → KPI summary (admin only)
│   ├── export/route.ts     → Excel/PDF download
│   └── donor-impact/route.ts → Donor impact report

src/app/(admin)/reports/
├── page.tsx                → KPI dashboard UI
├── components/
│   ├── KpiCards.tsx         → Summary cards (jobs, users, TRPB)
│   ├── JobChart.tsx         → Job status distribution chart
│   ├── TierChart.tsx        → Student tier distribution
│   ├── TrpbChart.tsx        → TRPB volume over time
│   └── ExportButton.tsx     → Download Excel/PDF
```

## Logging Format (Structured JSON)
```json
{
  "timestamp": "2026-04-03T10:30:00Z",
  "level": "info",
  "event": "job.state_change",
  "job_id": "clx...",
  "from_state": "IN_PROGRESS",
  "to_state": "SUBMITTED",
  "actor_id": "usr...",
  "actor_role": "student",
  "duration_ms": 45
}
```

## กฎ
- **ห้าม log** ข้อมูลส่วนบุคคล: password, private key, wallet secret
- **ห้าม log** PII โดยไม่จำเป็น (ชื่อ-สกุล OK, เลขบัตรประชาชน ห้าม)
- **PDPA compliance** — retention policy ≤ 1 ปี
- **ห้ามแก้ไข** business logic — เฉพาะ logging/metrics/dashboard
- **Admin only** — KPI dashboard ต้องตรวจ role = admin/superadmin
- Charts ใช้ lightweight library (recharts หรือ chart.js)

## การรายงานสถานะ
- เขียน status ใน `agents/.comms/status-analytics.md`
- แจ้ง blocker ใน `agents/.comms/issues-analytics.md`
