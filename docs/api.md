# API Routes

API ทั้งหมดอยู่ใน `src/app/api/*` ใช้ Next.js Route Handlers
ทุก endpoint ตรวจ session ผ่าน Supabase และ validate body ด้วย Zod

## Auth
| Method | Path | Description |
|---|---|---|
| — | `/api/auth/*` | callback / signout (ดูในโฟลเดอร์) |

## Jobs
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/jobs` | list / create job |
| GET/PATCH | `/api/jobs/[id]` | ดู / แก้งาน |
| POST | `/api/jobs/[id]/approve` | staff อนุมัติงาน |
| POST | `/api/jobs/[id]/cancel` | ยกเลิกงาน + refund Escrow |
| POST | `/api/jobs/[id]/schedule` | กำหนดตารางงาน |
| POST | `/api/jobs/[id]/submit` | นักศึกษาส่งงาน |
| POST | `/api/jobs/[id]/confirm-completion` | employer ยืนยันรับงาน |

## Evaluations & Reviews
| Method | Path | Description |
|---|---|---|
| POST | `/api/evaluations` | สร้าง evaluation (teacher) |
| POST | `/api/reviews` | multi-source review |

## Disputes
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/disputes` | list / สร้าง dispute |
| POST | `/api/disputes/[id]/resolve` | admin/staff ตัดสิน |

## Chat
| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/[jobId]` | metadata ห้องแชทของงาน |
| GET/POST | `/api/chat/[jobId]/messages` | list / ส่งข้อความ |
| GET/POST | `/api/chat/[jobId]/agreement` | ข้อตกลงในแชท |

## Notifications
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/notifications` | list / mark read |

## Other
- `/api/donations` — กองทุนบริจาค
- `/api/escrow` — เรียก contract Escrow
- `/api/equipment` — เครื่องมือ/อุปกรณ์
- `/api/exemptions` — งาน EXEMPTED
- `/api/fund` — สถานะกองทุน
- `/api/tiers` — student tier
- `/api/work-instructions` — คู่มือ/ขั้นตอนการทำงาน

## Convention

- Body validate ด้วย Zod ทุกครั้ง — return 400 ถ้าผิด
- ตรวจสิทธิ์ตาม role ก่อนทำ mutation — return 403 ถ้าไม่ผ่าน
- Error เป็น JSON `{ error: string }`
- Success เป็น JSON ของ resource โดยตรง

> **TODO:** เพิ่ม OpenAPI spec อัตโนมัติในอนาคต — ตอนนี้ดู source code เป็น truth
