# SkillChain Vision

> **"ระบบเรียนรู้ทักษะอาชีพที่ตรวจสอบได้ทุกขั้นตอน
> ขับเคลื่อนโดยภาคสังคมและชุมชน
> เป็นฐานข้อมูลคนเก่งที่โลกยอมรับได้"**

## หลักการ 5 ข้อ

1. **Verifiable Everything** — ทุกการประเมิน ทุกใบรับรอง ทุก tx ตรวจสอบย้อนหลังได้ on-chain
2. **Community-Driven** — ขับเคลื่อนด้วยอาสา + บริจาค ไม่รอรัฐ
3. **Lifelong Learning** — มีเส้นทางพัฒนาทักษะตั้งแต่มือใหม่ → master
4. **Open Talent Pool** — คนเก่งค้นเจอได้ ทักษะพิสูจน์ได้
5. **Standards-Aligned** — สอดคล้องกับ TPQI / DSD / มาตรฐานสากล

## ภาพรวม End State

```
                    ┌───────────────────┐
                    │   ภาคสังคม/ชุมชน  │
                    │  (donor, partner) │
                    └─────────┬─────────┘
                              │ บริจาค / MOU
                              ▼
        ┌──────────────────────────────────────────┐
        │            SkillChain Platform           │
        │                                          │
        │  ┌─────────┐  ┌─────────┐  ┌──────────┐  │
        │  │ Learn   │─▶│  Work   │─▶│ Certify  │  │
        │  │(course) │  │ (jobs)  │  │ (W3C VC) │  │
        │  └────┬────┘  └────┬────┘  └────┬─────┘  │
        │       └────────────┼────────────┘        │
        │                    ▼                     │
        │         ┌────────────────────┐           │
        │         │  Talent Directory  │           │
        │         │  (public profile)  │           │
        │         └────────────────────┘           │
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │ TRON (on-chain) │
                    │ TRPB + NFT + VC │
                    └─────────────────┘
```

## โมดูลที่ประกอบเป็น vision

### มีแล้ว ✅
- Job marketplace + Escrow + 360° evaluation
- Credential 5 levels + NFT
- Multi-role RBAC (8 roles)
- Donation fund + behavior log

### กำลังเสนอ (proposals) 📝
1. [Training Program](proposals/training-program.md) — pipeline เรียนก่อนทำงาน
2. [Skill Taxonomy](proposals/skill-taxonomy.md) — ภาษากลางของทักษะ
3. [Talent Directory](proposals/talent-directory.md) — public profile + portfolio
4. [Learning Path](proposals/learning-path.md) — career ladder ส่วนตัว
5. [Verifiable Credential](proposals/verifiable-credential.md) — W3C VC + DID
6. [Community & Mentorship](proposals/community-mentorship.md) — endorsement + pairing

### Backlog (อนาคต) 🔮
- Equipment lending, insurance, impact report, multi-language, mobile PWA, dispute mediation

## เกณฑ์ความสำเร็จ (KPI ที่อยากเห็น)

| มิติ | ตัวชี้วัด |
|---|---|
| การเรียนรู้ | จำนวน นศ. ที่เลื่อน level/ปี, % completion ของ course |
| การจ้างงาน | จำนวนงานสำเร็จ, มูลค่ารวม TRPB ที่หมุนในระบบ |
| คุณภาพ | คะแนนเฉลี่ย, % safety incident, % dispute |
| ภาคสังคม | จำนวน donor, ยอดบริจาค, อัตรา earmark สำเร็จ |
| ตรวจสอบได้ | % ของ credential ที่ verify ได้ on-chain |
| ฐานคนเก่ง | จำนวน talent profile public, traffic/search |

## ลำดับการพัฒนา (แนะนำ)

```
Phase 1 (ปัจจุบัน)  Phase 2          Phase 3           Phase 4
  Testnet            Mainnet ready     External open     Federation
  ────────          ────────          ────────          ────────
  - Jobs ✅          - Hybrid pay      - คนนอก มทร.       - W3C VC
  - Credential ✅    - Auto escrow     - Donor portal    - Cross-org
  - Training         - Skill taxonomy  - Talent search   - Mobile PWA
    (volunteer)      - Portfolio       - Learning path
                     - Public profile  - Endorsement
```

---

**หมายเหตุ:** เอกสารนี้คือ "ดาวเหนือ" ไม่ใช่ commitment
proposal แต่ละอันจะเป็นที่ตัดสินใจรายละเอียดอีกครั้ง
