# Spotify/YT Music Look & Feel — Future Design Proposal

> เก็บ idea ไว้สำหรับ sprint ครั้งถัดไป — ยังไม่ implement
> Inspired by Spotify + YouTube Music mobile dashboards

---

## Reference

ภาพอ้างอิงจากผู้ใช้:
- YouTube Music (บน) — Speed dial 2×4 grid, large covers, dark overlay
- Spotify (ล่าง) — filter chips, recent items, gradient banner "Let DJ pick the music"

## องค์ประกอบที่จะ port มา

| Element | จากภาพ | ที่ใช้ในระบบเรา |
|---|---|---|
| **Dark theme** | สีดำ + glass overlay | ทั้ง app + toggle ที่ UserMenu |
| **Speed dial grid** | 2×4 big thumbnail cards | งานล่าสุด / favorite / recommended |
| **Filter chips** | All / Music / Podcasts (pill green active) | ทั้งหมด / งานจ้าง / จิตอาสา / กิจกรรมกลุ่ม |
| **Bottom tabs** | Home / Recents / Browse / Library | (มีอยู่ — ปรับ style) |
| **Glassmorphism cards** | `bg-black/40 backdrop-blur-xl` | Hero + cards |
| **Gradient banner CTA** | "Let DJ pick the music" | "🎯 AI หางานให้คุณ" |
| **Large visual covers** | album art ใหญ่ | job category gradient + photo |

## Scope — 3 sprints

### Sprint A — Dark theme + Dashboard redesign
1. Dark theme CSS variables + toggle ที่ UserMenu (using `next-themes`)
2. Student dashboard ใหม่:
   - Hero gradient + welcome + level
   - Speed dial 2×4 (งานล่าสุด / favorite / recommend)
   - Filter chips สีเขียวเด่น
   - Recent jobs list cards
   - Bottom gradient banner CTA

### Sprint B — Port style ไปหน้าอื่น
- Student jobs (หางานทำ) — grid Spotify-style
- Wallet — music player hero style
- Profile — large avatar + glass cards

### Sprint C — Other roles
- Employer dashboard (optional — formal context อาจไม่เหมาะ)
- Activity attendance page

## Boundaries (สำคัญ)

- **เก็บ classic style** ไว้สำหรับ:
  - Admin pages (formal data tables)
  - Staff approval pages (เอกสารราชการ)
  - Gov batch flows
- **ปรับเฉพาะ student-facing pages** ก่อน — เหมาะกับ generation ที่ใช้ music apps

## Tech additions

- `next-themes` (~5KB) — theme switcher
- Tailwind dark variants
- Glassmorphism utility classes
- LocalStorage theme persistence

## Defaults

- Respect system preference (`prefers-color-scheme`)
- User can override via UserMenu toggle
- Default = system

---

## Status: 📌 Parked

เก็บไว้สำหรับ sprint ครั้งหน้าเมื่อพร้อม — ผู้ใช้บอกยังไม่ลุยตอนนี้
