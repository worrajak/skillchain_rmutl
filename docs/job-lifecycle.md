# Job Lifecycle

## สถานะงาน (`JobStatus`)

```
OPEN ─▶ ASSIGNED ─▶ CONFIRMED ─▶ IN_PROGRESS ─▶ SUBMITTED ─▶ COMPLETED
  │         │            │             │             │
  └─────────┴────────────┴─────────────┴─────────────┴──▶ CANCELLED / DISPUTED
```

| Status | ใครเปลี่ยน | เกิดอะไรขึ้น |
|---|---|---|
| `OPEN` | employer | เปิดรับสมัคร, lock เงินใน Escrow |
| `ASSIGNED` | staff/teacher | จับคู่นักศึกษา |
| `CONFIRMED` | student | นักศึกษายืนยันรับงาน |
| `IN_PROGRESS` | student/staff | เริ่มทำงานจริง |
| `SUBMITTED` | student | ส่งงานรอประเมิน |
| `COMPLETED` | teacher/employer | ประเมินผ่าน + Escrow `release()` |
| `CANCELLED` | staff/admin | ยกเลิก, refund Escrow |
| `DISPUTED` | ผู้เกี่ยวข้อง | มีข้อพิพาท → ขึ้นกับผลตัดสิน |

## Hiring Modes (`HiringMode`)
- `MODE_A` — employer ภายนอกจ้างตรง
- `MODE_B` — RMUTL staff เป็นผู้ว่าจ้างเทียมเพื่อฝึก
- `MODE_C` — โครงการใต้ร่มพระบารมีจัดให้

## Job Types
- `PAID` — มีค่าตอบแทน, ใช้ Escrow
- `VOLUNTEER` — งานอาสา, ไม่ผ่าน Escrow แต่ยังประเมิน
- `TRAINING` — งานฝึก มี mentor (`is_mentorship = true`)
- `EXEMPTED` — ยกเว้นเงื่อนไขปกติ (อนุมัติเป็นกรณี)

## Evaluation Window
- `eval_window_start` / `eval_window_end` กำหนดช่วงประเมินหลังส่งงาน
- ค่า default `eval_window_days = 7`
- พ้น window แล้วระบบ auto-complete (ถ้า config)

## Multi-source Review
- `EmployerReview` — employer → student
- `StudentReview` — student → employer
- `MentorReview` — mentor → trainee (เฉพาะ training)

ทุก review บันทึก `on_chain_tx` + `content_hash` เพื่อ audit
