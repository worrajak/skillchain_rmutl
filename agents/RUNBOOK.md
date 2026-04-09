# SkillChain Multi-Agent Runbook
## คู่มือใช้งาน 22 Agents สำหรับพัฒนา SkillChain มทร.ล้านนา

---

## Quick Start

```bash
# วิธีที่ 1: Interactive menu (แนะนำ)
bash scripts/agents.sh

# วิธีที่ 2: เลือก mode ตรง
bash scripts/agents.sh dev        # Development (6 agents)
bash scripts/agents.sh review     # Code Review (4 agents)
bash scripts/agents.sh debug      # Bug Hunting (3 agents)
bash scripts/agents.sh docs       # Documentation (3 agents)
bash scripts/agents.sh ops        # Ops: DevOps+Seed+Analytics (3 agents)
bash scripts/agents.sh migrate    # DB Migration (1 agent)
bash scripts/agents.sh extract    # Extract Module (2 agents)
bash scripts/agents.sh i18n       # Internationalization (1 agent)
bash scripts/agents.sh audit      # Smart Contract Audit (1 agent)

# Utility commands
bash scripts/agents.sh list       # list all 22 agents
bash scripts/agents.sh status     # show active sessions
bash scripts/agents.sh kill       # kill all sessions

# รัน agent ตัวเดียว
bash scripts/agents.sh single agents/dev/backend.md
```

Claude จะ **auto-launch** ในทุก pane  
เพิ่ม `--no-auto` ถ้าต้องการรัน claude เอง:
```bash
bash scripts/agents.sh dev --no-auto
```

---

## สารบัญ
1. [tmux เบื้องต้น](#1-tmux-เบื้องต้น)
2. [Agent ทั้ง 22 ตัว](#2-agent-ทั้ง-22-ตัว)
3. [Case Study 1: พัฒนา Sprint](#3-case-study-1-พัฒนา-sprint)
4. [Case Study 2: Code Review + Contract Audit](#4-case-study-2-code-review--contract-audit)
5. [Case Study 3: DB Migration](#5-case-study-3-db-migration)
6. [Case Study 4: เขียน Documentation](#6-case-study-4-เขียน-documentation)
7. [Case Study 5: Bug Hunting](#7-case-study-5-bug-hunting)
8. [Case Study 6: Extract Module](#8-case-study-6-extract-module)
9. [Case Study 7: Ops — CI/CD + Seed + Analytics](#9-case-study-7-ops--cicd--seed--analytics)
10. [Case Study 8: i18n — ตั้งระบบภาษาไทย](#10-case-study-8-i18n--ตั้งระบบภาษาไทย)

---

## 1. tmux เบื้องต้น

### ติดตั้ง
```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux
```

### Shortcut สำคัญ (Ctrl+b แล้วปล่อย แล้วค่อยกด)

| กด | ผลลัพธ์ |
|----|---------|
| `Ctrl+b` `Arrow` | ย้าย pane |
| `Ctrl+b` `n` / `p` | window ถัดไป / ก่อนหน้า |
| `Ctrl+b` `z` | Zoom pane (เต็มจอ/คืนค่า) |
| `Ctrl+b` `d` | Detach (session ยังรันอยู่) |
| `Ctrl+b` `x` | ปิด pane |

```bash
tmux ls                          # ดู sessions
tmux attach -t skillchain        # กลับเข้า session
tmux kill-session -t skillchain  # ปิด session
```

---

## 2. Agent ทั้ง 22 ตัว

### Development (6 ตัว) — `bash scripts/agents.sh dev`
| # | Agent | ไฟล์ | หน้าที่ |
|---|-------|------|---------|
| 1 | Lead | `agents/dev/lead.md` | สั่งงาน, วางแผน, merge, human-in-loop |
| 2 | Backend | `agents/dev/backend.md` | API Routes, Prisma, Business Logic |
| 3 | Frontend | `agents/dev/frontend.md` | React, UI/UX, 6 Portals |
| 4 | QA | `agents/dev/qa.md` | Unit Test, E2E, Bug Report |
| 5 | Smart Contract | `agents/dev/smart-contract.md` | Solidity, TRON, TRC-20 |
| 6 | **i18n** | `agents/dev/i18n.md` | **next-intl, Thai translations, formatting** |

### Code Review (4 ตัว) — `bash scripts/agents.sh review`
| # | Agent | ไฟล์ | หน้าที่ |
|---|-------|------|---------|
| 7 | Security | `agents/review/security.md` | OWASP, PDPA, Wallet Security |
| 8 | Performance | `agents/review/performance.md` | Speed, DB Query, Blockchain |
| 9 | Test Coverage | `agents/review/test-coverage.md` | Coverage ≥80%, Edge Cases |
| 10 | **Contract Auditor** | `agents/review/contract-auditor.md` | **Solidity audit: reentrancy, gas, access control** |

### Documentation (4 ตัว) — `bash scripts/agents.sh docs`
| # | Agent | ไฟล์ | หน้าที่ |
|---|-------|------|---------|
| 11 | DB Migration | `agents/docs/db-migration.md` | Prisma migrate, Rollback |
| 12 | API Doc Writer | `agents/docs/writer-api.md` | API Reference |
| 13 | Student Manual | `agents/docs/writer-student.md` | คู่มือนักศึกษา |
| 14 | Employer Manual | `agents/docs/writer-employer.md` | คู่มือผู้ว่าจ้าง/Admin |

### Debug (3 ตัว) — `bash scripts/agents.sh debug`
| # | Agent | ไฟล์ | หน้าที่ |
|---|-------|------|---------|
| 15 | Bug Hunter FE | `agents/debug/bug-hunter-frontend.md` | วิเคราะห์จากมุม Frontend |
| 16 | Bug Hunter BE | `agents/debug/bug-hunter-backend.md` | วิเคราะห์จากมุม API/DB |
| 17 | Bug Hunter BC | `agents/debug/bug-hunter-blockchain.md` | วิเคราะห์จากมุม Blockchain |

### Ops (3 ตัว) — `bash scripts/agents.sh ops`
| # | Agent | ไฟล์ | หน้าที่ |
|---|-------|------|---------|
| 18 | **DevOps** | `agents/ops/devops.md` | **CI/CD, Docker, Vercel deploy, GitHub Actions** |
| 19 | **Seed & Demo** | `agents/ops/seed-demo.md` | **Seed data, demo scenarios, test fixtures** |
| 20 | **Analytics** | `agents/ops/analytics.md` | **Logging, KPI dashboard, Excel/PDF export** |

### Extract (2 ตัว) — `bash scripts/agents.sh extract`
| # | Agent | ไฟล์ | หน้าที่ |
|---|-------|------|---------|
| 21 | Extractor | `agents/extract/extractor.md` | แยก module ออกมา |
| 22 | Migrator | `agents/extract/migrator.md` | migrate ไปใช้ module ใหม่ |

---

## 3. Case Study 1: พัฒนา Sprint

```bash
bash scripts/agents.sh dev
```

Claude จะ auto-launch ใน 5 panes:
```
┌─────────────────┬─────────────────┐
│  Lead Agent     │  Backend Agent  │
├─────────────────┼─────────────────┤
│  Frontend Agent │  QA Agent       │
└─────────────────┴─────────────────┘
Window 2: Smart Contract Agent
```

### ขั้นตอน

**1. สั่ง Lead วางแผน** (Ctrl+b arrow ไปที่ Lead pane)
```
วางแผน Sprint 1: สร้าง Job Board + Mode A flow ตาม MasterPlan v3
ให้สร้าง API Spec ก่อน แล้ว approve ก่อนส่งให้ทีม
```
Lead จะเขียน spec ใน `agents/.comms/api-spec-sprint1.md`

**2. สั่ง Backend + Frontend + QA ทำงานพร้อมกัน** (ย้ายไปแต่ละ pane)

Backend:
```
อ่าน API Spec จาก agents/.comms/api-spec-sprint1.md แล้ว implement
ทุก endpoint ตามที่ Lead กำหนด ใช้ Git worktree แยก branch
```

Frontend:
```
อ่าน API Spec จาก agents/.comms/api-spec-sprint1.md แล้ว implement UI
ตาม spec ใช้ Git worktree แยก branch
```

QA:
```
อ่าน API Spec จาก agents/.comms/api-spec-sprint1.md
แล้วเขียน test script สำหรับทุก endpoint และ flow
```

**3. Merge + Test** — กลับไป Lead:
```
merge branch ของ Backend และ Frontend เข้า main แล้วให้ QA รัน E2E test
```

**4. แก้ Bug** — ถ้า QA พบ bug, Lead ส่งกลับ agent ที่รับผิดชอบ

---

## 4. Case Study 2: Code Review + Contract Audit

```bash
bash scripts/agents.sh review
```

สั่งทั้ง 3 ตัว (Security, Performance, Test Coverage):
```
ตรวจ code ทั้งโปรเจกต์ SkillChain แล้วเขียน report
```

**เสริมด้วย Contract Auditor** (รัน terminal แยก):
```bash
bash scripts/agents.sh audit
```
```
audit ทุก smart contract ใน contracts/ — เน้น TRPBToken.sol และ JobEscrow.sol
ตรวจ reentrancy, access control, fee calculation, TRON-specific issues
```

เมื่อเสร็จ อ่าน reports ใน `agents/.comms/review-*.md`

**Human-in-the-loop:**
- CRITICAL → แก้ทันที
- HIGH → แก้ก่อน deploy
- MEDIUM/LOW → ถามผู้ใช้ว่าจะแก้ตอนนี้หรือ backlog

---

## 5. Case Study 3: DB Migration

```bash
bash scripts/agents.sh migrate
```

สั่ง:
```
เพิ่ม field "phone" ในตาราง users
ต้อง backward compatible, มี rollback plan
```

Agent จะ: แก้ `prisma/schema.prisma` → สร้าง migration → เขียน rollback plan

---

## 6. Case Study 4: เขียน Documentation

```bash
bash scripts/agents.sh docs
```

สั่งทั้ง 3 ตัว:
```
อ่าน code ทั้งโปรเจกต์แล้วเขียน documentation ให้ครบ
```

---

## 7. Case Study 5: Bug Hunting (Hypothesis Challenge)

```bash
bash scripts/agents.sh debug
```

สั่งทั้ง 3 ตัวด้วยข้อความเดียวกัน:
```
ปัญหา: "หน้า Job Board โหลดช้ามาก ใช้เวลา 5+ วินาที"
วิเคราะห์จากมุมมองของคุณ ตั้ง hypothesis อย่างน้อย 3 ข้อ
แล้วเขียน report ใน agents/.comms/
```

เมื่อทั้ง 3 เสร็จ → อ่าน report → ดูว่า hypothesis ตรงกันที่จุดไหน → แก้

---

## 8. Case Study 6: Extract Module

```bash
bash scripts/agents.sh extract
```

**Pane ซ้าย (Extractor):**
```
extract Job State Machine ออกเป็น standalone module
ให้ใช้ซ้ำได้กับโปรเจกต์อื่น
```

**Pane ขวา (Migrator) — หลัง extract เสร็จ:**
```
module @skillchain/state-machine extract เสร็จแล้ว
migrate main project ให้ import จาก module ใหม่
```

---

## 9. Case Study 7: Ops — CI/CD + Seed + Analytics

```bash
bash scripts/agents.sh ops
```

3 agents auto-launch:
```
┌──────────────────┬──────────────────┐
│  DevOps Agent    │  Seed & Demo     │
├──────────────────┤                  │
│  Analytics Agent │                  │
└──────────────────┴──────────────────┘
```

### สั่งแต่ละตัว

**DevOps:**
```
สร้าง CI/CD pipeline: GitHub Actions (ci.yml + deploy)
Docker compose สำหรับ local dev
Health check endpoint /api/health
```

**Seed & Demo:**
```
สร้าง prisma/seed.ts — users ทุก role, jobs ทุก status
demo scenario สำหรับ pilot presentation
test fixtures สำหรับ QA
```

**Analytics:**
```
สร้าง structured logging + KPI dashboard สำหรับ Admin
metrics: จำนวน jobs, TRPB volume, tier distribution
export Excel/PDF สำหรับ report
```

---

## 10. Case Study 8: i18n — ตั้งระบบภาษาไทย

```bash
bash scripts/agents.sh i18n
```

สั่ง:
```
ตั้ง next-intl สำหรับ App Router
สร้าง messages/th.json + messages/en.json
แปล UI ทั้งหมดเป็นภาษาไทย
ตั้ง Thai date format (พ.ศ.) + currency (฿/TRPB)
```

Agent จะ: install next-intl → สร้าง middleware → สร้าง translation files → wire up components

---

## Tips

1. **`bash scripts/agents.sh`** — จำแค่คำสั่งเดียว เลือก mode จาก menu
2. **Ctrl+b z** — Zoom pane เต็มจอเวลาอ่าน output ยาว
3. **Ctrl+b d** — Detach เมื่อพัก session ยังรันอยู่
4. **`agents/.comms/`** — ที่เก็บ communication ระหว่าง agents
5. **Human-in-the-loop** — ตัดสินใจเรื่อง critical ด้วยตัวเอง
6. **`bash scripts/agents.sh kill`** — ปิดทุก session ทีเดียว
7. **`bash scripts/agents.sh status`** — ดูว่ามี session ไหนรันอยู่
