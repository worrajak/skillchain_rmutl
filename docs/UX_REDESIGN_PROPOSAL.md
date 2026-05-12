# SkillChain Mobile-First Redesign — Proposal

> เสนอแนวทางปรับ UX/UI สำหรับมือถือ + ใช้กล้อง + AI เป็น primary input
> ผู้ตรวจสอบ: ทีม SkillChain — ขอความเห็นก่อน implementation

---

## Executive summary

ปัจจุบันระบบใช้งานได้ครบ flow แต่ **UI ออกแบบเหมือน desktop ขนาดย่อ** — text-heavy, icon-only, ขาด visual storytelling. นักศึกษาช่างใช้มือถือเป็นเครื่องมือหลัก + ทำงานในสภาพแวดล้อมจริง (ในห้องช่าง, ในไซต์งาน) — ระบบควร **เปิดกล้องเป็น primary action** และ **ลด text input** ให้เหลือน้อยที่สุด

### สิ่งที่ผมเห็นเด่น 3 เรื่อง (จากการ audit จริง)

1. **หน้าแรกทื่อ + ขาด emotional hook** — โทน gradient ฟ้า-ม่วงเดียว, ไม่มีรูปจริง (นศ. ช่างทำงาน), 6 stat cards เป็น info dump
2. **Mobile nav ใช้ hamburger** — ทุกครั้งต้องเปิดเมนู → จบ flow 2 click ขึ้นไป (ควรเป็น bottom tab)
3. **กล้อง/QR เป็น secondary** — ทั้งที่จริงเป็น core input ของระบบ (รับงาน, ส่งงาน, ตรวจ)

---

## ส่วนที่ 1 — Audit หน้าจริงบน Mobile (375×812)

### 1.1 Landing `/` — ทื่อ, info-dump

**ที่เห็น:**
- Hero text 2 บรรทัดขนาดใหญ่ ("จ้างช่างนักศึกษา / โปร่งใส ตรวจสอบได้")
- Pill "1 TRPB = 1 อาสา" + "● TRON Nile Testnet"
- 4 feature pills เล็กๆ (Escrow / NFT / ประเมิน 3 ฝ่าย / พี่เลี้ยง)
- 6 stat cards (18 นศ. / 1 ผู้จ้าง / 6 งาน / 5 สำเร็จ / 0 ประเมิน / 0 ใบรับรอง)
- ไม่มีรูป ไม่มี testimonial ไม่มี CTA สีเด่น

**ปัญหา:**
- ไม่มี trust signal ที่จับใจ (ใบรับรอง = 0 → ดูเหมือนระบบยังไม่มีใครใช้)
- CTA "เริ่มต้นใช้งาน" / "ลงทะเบียน" — ไม่ standout (เป็น link ตัวเล็กในมุมขวาบน)
- เมื่อเลื่อนลงสุด → footer ขึ้น, ไม่มี secondary CTA (ลงทะเบียนตรงนี้)

### 1.2 Student dashboard

**ที่เห็น:**
- Header "สวัสดี, อาทิตย์ ลุงทา" + email + วิทยาเขต
- Card "Level 1 ลงทะเบียน" gradient เทา → ดูแห้งๆ (เหมือน placeholder)
- 4 stat cards (3 งานทั้งหมด / 0 กำลังทำ / 3 สำเร็จ / - คะแนนเฉลี่ย)
- Credential progress bar Lv1-Lv5 — UI ดี แต่ไม่ตื่นเต้น
- ลงสุด → "งานของฉัน" + "ดูทั้งหมด"

**ปัญหา:**
- Level card แห้ง — ควร gamify (badge ใหญ่ + animation + "อีก 2 งาน → Lv.2")
- ไม่มี "Quick Action" สำหรับงานสำคัญ (สแกน QR / ส่งงาน / ดูเงิน)
- Stats ไม่บอก trend (เพิ่มกี่ % จากเดือนก่อน?)
- หน้าแรกของ นศ. ควรนำสายตาไป **"งานที่ต้องทำต่อ"** ไม่ใช่ตัวเลขรวม

### 1.3 Student jobs list

**ที่เห็น:**
- Tabs "📌 งานของฉัน (3)" / "🔍 หางานทำ"
- Job cards: title + status pill + amount + employer + supervisor + dates + hint "🎉 งานเสร็จสมบูรณ์! — รอประเมินและจ่ายค่าจ้าง"

**ปัญหา:**
- **ไม่มี photo cover** ของงาน → ดูทุกงานเหมือนกัน
- Card ใหญ่เกิน (180px ต่อใบ) → เห็น 3 ใบเต็มหน้าจอ
- Status pill เล็ก, ไม่มี visual urgency (งานที่ใกล้ deadline ควรกระพริบ/แดง)
- ไม่มี swipe action (ปัด ← เพื่อดูรายละเอียด, ปัด → ติดดาว)

### 1.4 Wallet

**ที่เห็น:**
- Header "Wallet — TRPB" + "ยอด TRPB และประวัติการเคลื่อนไหว"
- Card ยอดคงเหลือ "2,000 TRPB" + warning "TRPB คือเหรียญทดสอบ..."
- ประวัติ 3 รายการ — แต่ละรายการเป็น list item แนวนอน

**ปัญหา:**
- ไม่มี "ดู on-chain" / "ดู TronScan" CTA สำหรับ TX ที่มี hash จริง
- ไม่มี chart/timeline แสดงการเปลี่ยนแปลง balance ตามเวลา
- "+ 900 TRPB" — ควร highlight สีเขียวเข้ม + icon arrow up
- ไม่มี filter ระหว่าง "เข้า / ออก" หรือ "งาน / โบนัส / ปรับแต่ง"

---

## ส่วนที่ 2 — Vision: "Camera-First, AI-Powered"

นักศึกษาช่างทำงานในไซต์งาน → มือถือ + กล้อง = เครื่องมือเดียว ระบบควรลดทุกอย่างที่ไม่จำเป็นออก

### 2.1 หน้าแรก mobile (Camera-Forward Hero)

**เปลี่ยนจาก:** Text-heavy hero
**เป็น:** Photo carousel ของ "นศ. ช่างกำลังทำงานจริง" (ภาพ 5-8 ใบ swipe ได้) + tagline สั้น + 1 CTA หลัก

```
┌─────────────────────────┐
│  [Photo: นศ.ช่างกำลัง   │  ← swipeable carousel
│   ติดตั้งแอร์ในห้องเรียน]│     auto-play 4s/slide
│                         │
│   ช่างนักศึกษามทร.       │
│   ทำงานจริง เก็บโปรไฟล์ │
│   ผ่านระบบ Blockchain   │
│                         │
│   ┏━━━━━━━━━━━━━━━━━━┓ │  ← Big CTA
│   ┃ 📷 สแกน QR เริ่ม  ┃ │     สีเด่น (สี theme primary)
│   ┃    หรือเข้าระบบ    ┃ │     full-width
│   ┗━━━━━━━━━━━━━━━━━━┛ │
│                         │
│   ── หรือ ──            │
│                         │
│   [ลงทะเบียนใหม่]        │  ← outline button
│   [ตรวจสอบใบรับรอง]      │
└─────────────────────────┘
       ↓ scroll
┌─────────────────────────┐
│  📊 ตัวเลขสำคัญ         │
│  ┌────┐ ┌────┐ ┌────┐  │  ← stat cards
│  │ 18 │ │  6 │ │  5 │  │     แต่เด่นกว่าตอนนี้
│  │นศ. │ │งาน │ │เสร็จ│  │     (ใส่ icon + trend)
│  └────┘ └────┘ └────┘  │
│                         │
│  ดูใหม่: 5 ผลงานล่าสุด   │  ← portfolio carousel
│  [photo] [photo] [photo]│     ของจริง
│                         │
│  💬 testimonial          │  ← card รูปคนพูด
│  "ผมได้ฝึกงานจริง..."   │     "อาทิตย์, ปวส.2"
└─────────────────────────┘
```

### 2.2 Mobile Bottom Tab Bar (แทน Hamburger)

**ปัญหา:** ทุก action ใช้ hamburger → กดเมนู → เลือก → 2 step

**แทนด้วย:** Bottom tab bar ติด fixed ด้านล่าง (5 tab เด็กๆ)

```
┌───────┬───────┬─────────┬───────┬───────┐
│ 🏠    │ 💼    │  📷     │ 💳    │ 👤    │
│ หน้าหลัก│ งาน   │  สแกน    │Wallet │โปรไฟล์│
└───────┴───────┴─────────┴───────┴───────┘
                  ↑
          Center FAB ใหญ่กว่า
          เด่น (สีเด่น)
```

ปุ่มกลาง "📷 สแกน" — ทำหน้าที่หลายอย่างขึ้นกับ context:
- **นศ.**: เปิดกล้องสแกน QR งาน → เช็คอิน / ส่งงาน / ดูสถานะ
- **Employer**: สแกน QR นศ. → เพิ่มเข้างาน / ยืนยันรับงาน
- **Staff**: สแกน QR งาน → review / approve

### 2.3 Camera-First Job Submission

**เปลี่ยนจาก:** ฟอร์ม upload รูปแบบ traditional (เลือกไฟล์ + crop + upload)
**เป็น:** เปิดกล้องตรง + AI ช่วย caption

```
นศ. กดปุ่ม [+ ส่งมอบงาน] บนหน้า detail
   ↓
เปิด camera fullscreen ด้วย MediaDevices.getUserMedia
   ↓
นศ. ถ่าย 3-5 รูป (ก่อน/ระหว่าง/หลัง) + เพิ่ม voice note
   ↓
AI วิเคราะห์: "ตรวจพบ: ติดตั้งพัดลมเพดาน 3 ชุด, สายไฟเรียบร้อย"
   ↓
นศ. ยืนยัน → ส่ง
```

**Tech:** ใช้ Anthropic Claude API (vision) — มีอยู่แล้วใน skill `claude-api`

### 2.4 AI Features ที่เสนอ

| Feature | จุดประสงค์ | API ที่ใช้ |
|---|---|---|
| **AI Job Estimator** | Employer ถ่ายรูปอุปกรณ์เสีย → AI ระบุประเภทงาน + ประมาณค่าจ้าง | Claude vision |
| **AI Photo Caption** | นศ. ถ่ายรูปงาน → AI generate caption ภาษาไทย | Claude vision |
| **AI Quality Check** | Staff/Employer ดู before/after → AI สรุปคุณภาพ + ความเรียบร้อย | Claude vision (compare) |
| **AI Voice → Text** | Staff/นศ. พูด comment → ถอดเสียงเป็นข้อความ | Whisper |
| **AI Smart Search** | Employer พิมพ์ "อยากซ่อมแอร์ในห้องสมุด" → AI หา นศ. ที่เหมาะ | Claude (RAG) |
| **AI Skill Recommender** | นศ. ดูหน้า credential → AI แนะนำคอร์ส/งานเพื่อขึ้น Level | Claude (planning) |

### 2.5 Visual Refresh

**Color palette (เสนอ):**
- Primary: `#0EA5E9` (sky blue) → trust + tech
- Accent: `#F59E0B` (amber) → energy + craftsman
- Success: `#10B981` (emerald)
- Background: `#FAFAF9` (warm white) — ไม่ใช้ pure white แน่น

**Typography:**
- Headings: `IBM Plex Sans Thai` หรือ `Sarabun` — modern + อ่านง่าย
- Numbers (ยอด TRPB, stats): `Space Grotesk` mono-style → tech feel

**Components ที่เสนอใช้เพิ่ม:**
- `<Drawer>` (shadcn) — bottom sheet แทน modal บนมือถือ
- `<Carousel>` — photo carousel (embla.js + ปุ่ม auto-play)
- `<Timeline>` — wallet history แสดง vertical timeline
- `<Skeleton>` — loading state สวยกว่า spinner เปล่าๆ
- `<Sonner>` — toast ดีขึ้น มี action button

---

## ส่วนที่ 3 — Implementation Roadmap

### Sprint 1 (1-2 weeks) — **Quick wins, high impact**
- [ ] Bottom tab bar (5 tabs + center FAB) ทุกหน้า authenticated
- [ ] Hero ใหม่: photo carousel + 1 big CTA + testimonial
- [ ] Job card: photo cover + visual urgency (deadline color)
- [ ] Skeleton loading (ทุก list page)
- [ ] Color palette refresh

### Sprint 2 (2-3 weeks) — **Camera + AI core**
- [ ] Camera-first job submit (open native camera fullscreen)
- [ ] AI photo caption (Claude vision API) — ภาษาไทย
- [ ] Voice note recording (browser MediaRecorder API)
- [ ] QR scan center FAB → auto-detect role + redirect
- [ ] Wallet: vertical timeline + filter chip

### Sprint 3 (3-4 weeks) — **AI features**
- [ ] AI Job Estimator — Employer ถ่ายรูป → ประเมินค่าจ้าง
- [ ] AI Quality Check — staff ดู before/after
- [ ] AI Skill Recommender — นศ. แนะนำเส้นทาง
- [ ] AI Smart Search — Employer หา นศ.
- [ ] Whisper Voice → text สำหรับ review

### Sprint 4 (1-2 weeks) — **Polish + launch ready**
- [ ] Profile completion score (gamification)
- [ ] Achievements badges (Lv. up animation)
- [ ] Push notifications (PWA + service worker)
- [ ] Onboarding tour (first-login)
- [ ] Hero image library — ถ่ายภาพจริง 20-30 รูป (นศ. ทำงานจริง)

---

## ส่วนที่ 4 — Tech stack ที่จะใช้เพิ่ม

| Layer | Tool | เหตุผล |
|---|---|---|
| Component lib | shadcn/ui (already) + add `Drawer`, `Carousel`, `Timeline` | ไม่ต้องเปลี่ยนทั้งหมด |
| Camera | `react-zxing` (QR) + native `<input type=file accept=image/*>` | ทำงานบนมือถือทุกระบบ |
| Voice | `MediaRecorder` API + Whisper API | Browser native + cheap |
| AI Vision | `@anthropic-ai/sdk` (Claude vision) | Already used in skills |
| AI Translate | Claude (TH ↔ EN) ผ่าน same SDK | Single API |
| Image opt | `next/image` + `sharp` (already configured) | Lazy load + WebP |
| Animation | `framer-motion` (lightweight) | Page transitions, micro-interactions |
| Charts | `recharts` หรือ `visx` | Wallet timeline, stats |

---

## ส่วนที่ 5 — User flows ใหม่ที่เสนอ

### 5.1 Student "เริ่มงานใหม่" flow (ลด step จาก 5 → 2)

**ก่อน:**
1. เปิดเมนู → 2. เลือก "งาน" → 3. tab "หางานทำ" → 4. เลื่อนหา → 5. กดส่งคำขอ

**หลัง:**
1. กด FAB กล้อง → 2. เลือก "หางานใกล้ฉัน" → list งานในวิทยาเขตเดียวกัน + ที่เหมาะกับ skill

หรือ Employer วาง QR ที่ป้ายประกาศ → นศ. สแกน → เห็นงาน → กดสมัครใน 1 click

### 5.2 Employer "ขอจ้างงาน" flow (ลด step จาก 8 → 3)

**ก่อน:** เปิดเมนู → ลงงาน → กรอกฟอร์ม 9 ช่อง → เลือกประเภท → เลือกหมวด → ใส่วันที่ → ใส่เงิน → กดส่ง

**หลัง:**
1. กด FAB กล้อง → ถ่ายรูปอุปกรณ์เสีย/พื้นที่ทำงาน
2. AI วิเคราะห์ + เสนอ template:
   ```
   📸 ตรวจพบ: แอร์ผนัง / 1 เครื่อง / สภาพต้องล้าง
   💡 เสนอ: "ล้างแอร์ผนังตึก A ห้อง 3"
   💰 ค่าจ้างประมาณ: 600-800 TRPB
   📅 ระยะเวลา: 1 วัน
   [ปรับแก้]  [ส่งเลย]
   ```
3. กด "ส่งเลย" → เสร็จ

### 5.3 Staff "review งาน" flow (ลด step จาก 4 → 1)

**ก่อน:** เปิดเมนู → review-jobs → คลิกงาน → อ่านดู → อนุมัติ

**หลัง:** Push notification → กดเข้า → เห็นรูป + AI summary "งานนี้คล้ายงานเดิมที่อนุมัติ 800 TRPB" → อนุมัติ/ปฏิเสธ

---

## ส่วนที่ 6 — ความเสี่ยง + ข้อพิจารณา

### Cost
- **AI vision APIs**: ~$0.003/image (Claude Haiku) → ทดสอบ 100 ครั้ง = $0.30
- **Whisper**: $0.006/min → comment 30 วิ = $0.003
- รวมต่อ user/เดือน: ~5-15 บาท

### PDPA
- ภาพถ่ายมีบุคคล → ต้อง explicit consent + face blur option
- Voice recording → store แล้ว auto-delete หลัง transcribe (default)

### Network
- มือถือในห้องช่าง wifi อ่อน → ต้อง offline-first (PWA + IndexedDB queue)
- Image compress ก่อน upload (target 200KB/รูป)

### Accessibility
- ตัวอักษร: min 16px เสมอ
- Touch target: min 44x44px
- Color contrast: AA standard

---

## ส่วนที่ 7 — สิ่งที่อยากชวนคุย

ก่อน implementation อยากขอความเห็น 5 เรื่อง:

1. **Hero photo** — มีรูป นศ. ทำงานจริงที่ใช้ได้ใน production ไหม? หรือต้องถ่ายใหม่?
2. **AI cost** — pilot 100 user × 30 ภาพ/เดือน = $90/m. รับได้ไหม? หรือ throttle?
3. **PWA install** — ติดตั้งเป็น app บน home screen? (ทำได้ฟรี ไม่ต้อง App Store)
4. **Native camera vs `<input>`** — เลือกตรงไหน? Native = สวยกว่า, `<input>` = ทำงานทุกที่
5. **Voice note** — เก็บ audio ไว้นานแค่ไหน? หรือ transcribe + ลบทันที?

---

## ส่วนที่ 8 — Quick Demo (ถ้าตกลง)

ผมเสนอเริ่มจาก **Sprint 1 quick wins** ที่ใช้เวลาน้อยแต่เห็นผลทันที:

1. Bottom tab bar (1 component, ใช้ทุกหน้า) — 1 วัน
2. Hero refresh (photo + CTA) — 1 วัน
3. Job card photo cover — 0.5 วัน
4. Color palette refresh (CSS variables) — 0.5 วัน
5. Skeleton loading — 0.5 วัน

รวม **~3-4 วัน** เห็นการเปลี่ยนชัดเจน → ค่อยตัดสินใจว่าจะทำ Sprint 2 (camera + AI) ต่อไหม

---

## สรุป — สิ่งที่ผมเสนอ

> เปลี่ยนจาก "web ที่เปิดบนมือถือได้" → "**mobile-first app ที่เปิดบน web ได้**"
>
> ใช้ **กล้อง + AI** เป็น input หลัก ลด text input ให้เหลือน้อยที่สุด
>
> ทุก action สำคัญ ≤ 2 click จากหน้าแรก

**คำถามต่อไป:** ตกลงเริ่มจาก Sprint 1 quick wins ก่อนไหม? หรือมีจุดที่อยากปรับใน proposal นี้ก่อน?
