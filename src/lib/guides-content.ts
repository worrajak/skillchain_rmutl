/**
 * Content for printable role guides.
 * Each guide is rendered to a 1-page A4 PDF for download/QR-share.
 */

export interface GuideStep {
  title: string;       // "1. เข้าสู่ระบบ"
  body: string;        // "พิมพ์ email + รหัสผ่าน แล้วกดปุ่ม..."
  image: string;       // path under /guides/img/<role>/<step>.png
}

export interface RoleGuide {
  slug: "student" | "employer" | "project_staff" | "rmutl_staff" | "teacher";
  roleLabel: string;
  color: string;       // tailwind text color
  bg: string;          // tailwind bg color
  emoji: string;
  tagline: string;     // big heading
  canCreateJobs: boolean;
  steps: GuideStep[];
  workflowCallouts: string[]; // bullet lines about other roles
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://skillchain-rmutl.vercel.app";

export const GUIDES: RoleGuide[] = [
  // ─────────────── นักศึกษา ───────────────
  {
    slug: "student",
    roleLabel: "นักศึกษา",
    color: "text-sky-700",
    bg: "bg-sky-50",
    emoji: "🧑‍🎓",
    tagline: "หางาน · ทำงานจริง · เก็บ TRPB · พัฒนาทักษะตัวเอง",
    canCreateJobs: false,
    steps: [
      {
        title: "1. เข้าสู่ระบบ",
        body: "เปิดเว็บ skillchain-rmutl.vercel.app → กรอกอีเมล + รหัสผ่าน → เข้าสู่ระบบ",
        image: "/guides/img/student/01-login.png",
      },
      {
        title: "2. หางาน",
        body: 'กดเมนู "งาน" → แท็บ "🔍 หางานทำ" → เลือกงานที่สนใจ → กด "ส่งคำขอรับงาน"',
        image: "/guides/img/student/02-jobs.png",
      },
      {
        title: "3. ทำงาน + ส่งรูป",
        body: 'หลังคณะทำงานอนุมัติ → เสนอวันทำงาน → กด "📷 เปิดกล้อง" ถ่ายรูประหว่างทำ (AI ช่วยอธิบายให้)',
        image: "/guides/img/student/03-work.png",
      },
      {
        title: "4. ส่งมอบงาน",
        body: 'ถ่ายรูปงานเสร็จ ≥ 1 รูป → กดปุ่ม "ส่งมอบงาน" → รอผู้จ้าง + คณะทำงานยืนยัน',
        image: "/guides/img/student/04-submit.png",
      },
      {
        title: "5. ประเมินผู้จ้าง",
        body: "ให้คะแนน ผู้จ้าง/ผู้สร้างงาน 3 ด้าน: ความชัดเจน · การจ่าย · ความปลอดภัย",
        image: "/guides/img/student/05-review.png",
      },
      {
        title: "6. รับ TRPB",
        body: 'กดเมนู "Wallet" → ดูยอด TRPB + ประวัติ → ตรวจสอบบน TRON Nile testnet ได้',
        image: "/guides/img/student/06-wallet.png",
      },
    ],
    workflowCallouts: [
      "ผู้จ้าง/คณะทำงาน/อาจารย์ สร้างงานให้คุณรับ",
      "คณะทำงานใต้ร่มฯ อนุมัติคำขอ + ปล่อย TRPB",
      "ผู้จ้างประเมินคุณ — คะแนนสะสมในโปรไฟล์ + ใบรับรอง NFT",
    ],
  },

  // ─────────────── ผู้จ้างงาน ───────────────
  {
    slug: "employer",
    roleLabel: "ผู้จ้างงาน",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    emoji: "💼",
    tagline: "ลงงาน · ให้ช่าง นศ. ทำงานจริง · จ่ายด้วย TRPB ผ่าน Blockchain",
    canCreateJobs: true,
    steps: [
      {
        title: "1. เข้าสู่ระบบ",
        body: "เปิดเว็บ → ล็อกอินด้วยอีเมลที่ลงทะเบียนไว้กับโครงการ",
        image: "/guides/img/employer/01-login.png",
      },
      {
        title: "2. สร้างงานใหม่",
        body: 'เมนู "ลงงานใหม่" → ✨ AI Estimator: ถ่ายรูปอุปกรณ์ → AI กรอกหัวข้อ/ราคาให้ → ปรับ + บันทึก',
        image: "/guides/img/employer/02-new-job.png",
      },
      {
        title: "3. รอ Staff อนุมัติ",
        body: "งานสถานะ \"รอพิจารณา\" → คณะทำงานใต้ร่มฯ เห็นชอบเรื่องค่าจ้าง → เปิดรับสมัคร",
        image: "/guides/img/employer/03-pending.png",
      },
      {
        title: "4. ติดตามงาน",
        body: "หน้างาน → ดูรูประหว่างทำ + ความคืบหน้า · เสนอวันทำงานร่วมกับ นศ. + ผู้กำกับ",
        image: "/guides/img/employer/04-track.png",
      },
      {
        title: "5. ยืนยันงานเสร็จ",
        body: 'นศ. กดส่งมอบงาน → คุณดูรูปงานเสร็จ → กด "ยืนยันงานเสร็จ" + เขียนประเมิน',
        image: "/guides/img/employer/05-confirm.png",
      },
      {
        title: "6. ค่าจ้างถูกหัก",
        body: "คณะทำงาน \"ปล่อย Escrow\" → 90% เข้า นศ. · 5% กองทุน · 5% คณะ — บันทึก On-chain",
        image: "/guides/img/employer/06-paid.png",
      },
    ],
    workflowCallouts: [
      "คณะทำงานใต้ร่มฯ อนุมัติงานของคุณก่อนเปิดรับสมัคร",
      "นักศึกษา รับงาน + ส่งงาน + ประเมินคุณกลับ",
      "TRPB ถูกหักจากกระเป๋าเฉพาะตอนคณะทำงาน \"ปล่อย Escrow\"",
    ],
  },

  // ─────────────── คณะทำงานใต้ร่มฯ ───────────────
  {
    slug: "project_staff",
    roleLabel: "คณะทำงานใต้ร่มพระบารมี",
    color: "text-amber-700",
    bg: "bg-amber-50",
    emoji: "🛡️",
    tagline: "พิจารณา · อนุมัติ · กำกับงาน · ปล่อย TRPB · ออกเอกสารราชการ",
    canCreateJobs: true,
    steps: [
      {
        title: "1. พิจารณางานใหม่",
        body: 'เมนู "พิจารณางานใหม่" → ดูรายละเอียดงาน + ค่าจ้างที่ผู้จ้างเสนอ → ปรับ/อนุมัติ/ปฏิเสธ',
        image: "/guides/img/project_staff/01-review.png",
      },
      {
        title: "2. อนุมัติคำขอรับงาน",
        body: 'เมนู "อนุมัติรับงาน" → นศ. แต่ละคนที่สมัคร → กด "อนุมัติ" (รองรับงานทีม)',
        image: "/guides/img/project_staff/02-approve.png",
      },
      {
        title: "3. ติดตามงานทั้งหมด",
        body: 'เมนู "ติดตามงาน" → กรองตามสถานะ · ดูทีม + รูปทุกขั้นตอน · คุณคือ "ผู้กำกับ"',
        image: "/guides/img/project_staff/03-track.png",
      },
      {
        title: "4. ปล่อย Escrow",
        body: 'งานสถานะ "เสร็จสมบูรณ์" → กด "💸 จ่ายค่าจ้าง" → ระบบหัก TRPB จาก Pool ผู้จ้าง → On-chain',
        image: "/guides/img/project_staff/04-release.png",
      },
      {
        title: "5. รวบเอกสารขออนุมัติ",
        body: 'เมนู "📄 เอกสารขออนุมัติ (รอบ)" → เลือกช่วง 3-7 วัน → เลือกงาน → ออก .docx + .md',
        image: "/guides/img/project_staff/05-batch.png",
      },
      {
        title: "6. ส่งให้รองอธิการ/อธิการ",
        body: 'ดาวน์โหลด .docx → พิมพ์ → ให้ลงนาม → กลับมากด "อนุมัติแล้ว" — งานทุกชิ้นในรอบปลดล็อก',
        image: "/guides/img/project_staff/06-sign.png",
      },
    ],
    workflowCallouts: [
      "ผู้จ้าง + อาจารย์ + คุณ ทุก role สามารถ \"สร้างงาน\" ได้",
      "การปล่อย Escrow แบ่ง 3 ทาง: 90% นศ. · 5% กองทุน · 5% คุณ (คณะทำงาน)",
      "เอกสาร batch ครอบหลายงาน — ลดภาระเซ็นของผู้บริหาร",
    ],
  },

  // ─────────────── คณะทำงาน มทร.ล้านนา ───────────────
  {
    slug: "rmutl_staff",
    roleLabel: "คณะทำงาน มทร.ล้านนา",
    color: "text-orange-700",
    bg: "bg-orange-50",
    emoji: "🏛️",
    tagline: "ภาพรวมโครงการ · กำกับข้ามวิทยาเขต · ตรวจสอบเอกสารราชการ",
    canCreateJobs: true,
    steps: [
      {
        title: "1. ภาพรวม Dashboard",
        body: "ดูสถิติทั้งระบบ: จำนวนงาน · นศ. ที่กำลังทำ · ยอด TRPB ที่ใช้ · ใบรับรองที่ออก",
        image: "/guides/img/rmutl_staff/01-dashboard.png",
      },
      {
        title: "2. สร้างงานเชิงนโยบาย",
        body: "เมนู \"ลงงานใหม่\" — งานระดับมหาวิทยาลัยที่จะกระจายให้ นศ. ข้ามวิทยาเขต",
        image: "/guides/img/rmutl_staff/02-new-job.png",
      },
      {
        title: "3. ตรวจสอบทุกงาน",
        body: "เมนู \"ติดตามงาน\" — เห็นงานทุก vista ทุก role พร้อมตัวกรองวิทยาเขต/หมวด",
        image: "/guides/img/rmutl_staff/03-track.png",
      },
      {
        title: "4. ตรวจสอบรอบ Batch",
        body: "เมนู \"เอกสารขออนุมัติ (รอบ)\" → ดูทุกรอบ + เอกสาร .docx เพื่อยืนยันความถูกต้อง",
        image: "/guides/img/rmutl_staff/04-batches.png",
      },
      {
        title: "5. รายงานต่อผู้บริหาร",
        body: "ส่งออกสรุปยอดรายเดือน + รายงานการใช้ TRPB Pool + จำนวน นศ. ที่ได้ประสบการณ์",
        image: "/guides/img/rmutl_staff/05-reports.png",
      },
      {
        title: "6. ลายเซ็นรองอธิการ",
        body: "ผู้บริหารระดับรองฯ → กด \"📝 รองอธิการเซ็นแล้ว\" → ขั้นสุดท้ายส่งให้อธิการเซ็น",
        image: "/guides/img/rmutl_staff/06-sign.png",
      },
    ],
    workflowCallouts: [
      "ข้อมูลในระบบมาจากคณะทำงานใต้ร่มฯ + ผู้จ้าง + อาจารย์",
      "ทุกธุรกรรม TRPB บันทึก On-chain TRON Nile testnet — ตรวจสอบได้",
      "คุณคือชั้นรองที่เซ็นก่อนส่งให้อธิการบดี (workflow ทาง batch)",
    ],
  },

  // ─────────────── อาจารย์ ───────────────
  {
    slug: "teacher",
    roleLabel: "อาจารย์",
    color: "text-purple-700",
    bg: "bg-purple-50",
    emoji: "👩‍🏫",
    tagline: "สอนผ่านงานจริง · ประเมิน นศ. · ดู Portfolio · ออกใบรับรอง",
    canCreateJobs: true,
    steps: [
      {
        title: "1. เข้าสู่ระบบ",
        body: "เข้าด้วยอีเมล @rmutl.ac.th → ระบบจัดเข้าหน้าอาจารย์อัตโนมัติ",
        image: "/guides/img/teacher/01-login.png",
      },
      {
        title: "2. สร้างงาน Project-based",
        body: "เมนู \"ลงงานใหม่\" → สร้างงานเรียนรู้ที่ นศ. ทำได้จริง → ระบุระดับทักษะ",
        image: "/guides/img/teacher/02-new-job.png",
      },
      {
        title: "3. ดูรายชื่อ นศ.",
        body: "เมนู \"นักศึกษา\" → ดูรายชื่อ + ผลงาน + คะแนนสะสมจาก Mentor/ผู้จ้าง",
        image: "/guides/img/teacher/03-students.png",
      },
      {
        title: "4. ดู Portfolio",
        body: "คลิก นศ. → ดูประวัติงาน + รูป before/during/after + คะแนน 3 ฝ่าย",
        image: "/guides/img/teacher/04-portfolio.png",
      },
      {
        title: "5. ประเมินผลภาคเรียน",
        body: 'เมนู "ประเมิน" → ให้คะแนน นศ. รายงานต่อ tier system — มีผลต่อ NFT ใบรับรอง',
        image: "/guides/img/teacher/05-evaluate.png",
      },
      {
        title: "6. ดู Credential",
        body: "ระดับทักษะ Lv.1-5: ลงทะเบียน · ผ่านอบรม · รับงาน · ทำงานจริง · ช่างเชี่ยวชาญ",
        image: "/guides/img/teacher/06-credential.png",
      },
    ],
    workflowCallouts: [
      "คุณ + คณะทำงาน + ผู้จ้าง สร้างงานให้ นศ. ทำได้ทุกคน",
      "คะแนนจากคุณรวมกับ ผู้จ้าง + Mentor → คะแนนรวม นศ. (40/35/25)",
      "นศ. ระดับสูงขึ้นได้ผ่านการทำงาน + ฝึกอบรม + ใบรับรอง",
    ],
  },
];

export function getGuide(slug: string): RoleGuide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export const APP_DOWNLOAD_BASE = APP_URL;
