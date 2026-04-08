# Changelog

ทุกการเปลี่ยนแปลงที่สำคัญของโปรเจกต์จะถูกบันทึกไว้ในไฟล์นี้

รูปแบบยึดตาม [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
และโปรเจกต์ใช้ [Semantic Versioning](https://semver.org/)

## [Unreleased]

### Added
- README, CONTRIBUTING, docs/ เต็มชุด (architecture, smart-contracts, job-lifecycle, database, roles)
- LICENSE (MIT), SECURITY policy, CODE_OF_CONDUCT
- GitHub Actions CI workflow (lint + prisma validate + build)
- GitHub issue/PR templates
- Supabase setup guide, deployment guide, TRON setup guide, credential guide, API reference

### Changed
- (ระบุเมื่อมีการเปลี่ยน behavior สำคัญ)

### Fixed
- (ระบุเมื่อมีการแก้ bug)

---

## [0.1.0] - 2026-04-08

### Added
- Job lifecycle: staff supervisor, work schedule, submit & confirm
- TRPB balance badge ใน navbar
- TRPB on-chain data ในหน้า About
- Deploy TRPB + JobEscrow contracts บน TRON Nile Testnet
- Multi-source review system
- Credential 5 levels
- 8 user roles + approval flow

### Fixed
- ลบ FK join dependency สำหรับ `approved_by_staff`
