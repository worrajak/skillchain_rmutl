import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires adapter-based connection
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ============================================================
// SkillChain Seed Data — Pilot Phase เม.ย.–ส.ค. 2569
// วิทยาเขต: หัวยแก้ว (huaykaew), ดอยสะเก็ด (doisaket)
// ============================================================

async function main() {
  console.log("🌱 Seeding SkillChain database...\n");

  // ----------------------------------------------------------
  // 1. USERS — ทุก role
  // ----------------------------------------------------------

  // === Admin (2) ===
  const admin1 = await prisma.user.upsert({
    where: { email: "somchai.admin@rmutl.ac.th" },
    update: {},
    create: {
      email: "somchai.admin@rmutl.ac.th",
      name: "สมชาย ใจดี",
      role: "admin",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      staff_position: "ผู้ดูแลระบบ",
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: "waraporn.admin@rmutl.ac.th" },
    update: {},
    create: {
      email: "waraporn.admin@rmutl.ac.th",
      name: "วราภรณ์ สุขสม",
      role: "admin",
      campus: "doisaket",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      staff_position: "ผู้ดูแลระบบ วิทยาเขตดอยสะเก็ด",
    },
  });

  // === Superadmin (1) ===
  const superadmin = await prisma.user.upsert({
    where: { email: "pimolpan.super@rmutl.ac.th" },
    update: {},
    create: {
      email: "pimolpan.super@rmutl.ac.th",
      name: "พิมลพรรณ เลิศบุญเรือง",
      role: "superadmin",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      staff_position: "หัวหน้าโครงการ SkillChain",
    },
  });

  // === Teachers (3) ===
  const teacher1 = await prisma.user.upsert({
    where: { email: "prasit.t@rmutl.ac.th" },
    update: {},
    create: {
      email: "prasit.t@rmutl.ac.th",
      name: "ประสิทธิ์ แสงทอง",
      role: "teacher",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      faculty: "วิศวกรรมไฟฟ้า",
      teacher_id_card: "T-6701",
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: "siriwan.t@rmutl.ac.th" },
    update: {},
    create: {
      email: "siriwan.t@rmutl.ac.th",
      name: "ศิริวรรณ พงศ์ประดิษฐ์",
      role: "teacher",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      faculty: "วิศวกรรมเครื่องกล",
      teacher_id_card: "T-6702",
    },
  });

  const teacher3 = await prisma.user.upsert({
    where: { email: "wichai.t@rmutl.ac.th" },
    update: {},
    create: {
      email: "wichai.t@rmutl.ac.th",
      name: "วิชัย คำมูล",
      role: "teacher",
      campus: "doisaket",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      faculty: "วิศวกรรมโยธา",
      teacher_id_card: "T-6703",
    },
  });

  // === Project Staff (2) ===
  const staff1 = await prisma.user.upsert({
    where: { email: "anong.staff@rmutl.ac.th" },
    update: {},
    create: {
      email: "anong.staff@rmutl.ac.th",
      name: "อนงค์ รักษาศีล",
      role: "project_staff",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      staff_position: "เจ้าหน้าที่โครงการใต้ร่มพระบารมี",
    },
  });

  const staff2 = await prisma.user.upsert({
    where: { email: "thanapol.staff@rmutl.ac.th" },
    update: {},
    create: {
      email: "thanapol.staff@rmutl.ac.th",
      name: "ธนพล วงศ์สกุล",
      role: "project_staff",
      campus: "doisaket",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      staff_position: "เจ้าหน้าที่โครงการ วิทยาเขตดอยสะเก็ด",
    },
  });

  // === RMUTL Staff (2) — ผู้ว่าจ้างเทียม ===
  const rmutlStaff1 = await prisma.user.upsert({
    where: { email: "sompong.rmutl@rmutl.ac.th" },
    update: {},
    create: {
      email: "sompong.rmutl@rmutl.ac.th",
      name: "สมพงษ์ ทองคำ",
      role: "rmutl_staff",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      staff_position: "หัวหน้าฝ่ายอาคารสถานที่",
      organization: "มทร.ล้านนา เชียงใหม่",
    },
  });

  const rmutlStaff2 = await prisma.user.upsert({
    where: { email: "nittaya.rmutl@rmutl.ac.th" },
    update: {},
    create: {
      email: "nittaya.rmutl@rmutl.ac.th",
      name: "นิตยา แก้วมณี",
      role: "rmutl_staff",
      campus: "doisaket",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      staff_position: "หัวหน้าฝ่ายซ่อมบำรุง",
      organization: "มทร.ล้านนา ดอยสะเก็ด",
    },
  });

  // === Employers (5) — 3 ภายใน + 2 ภายนอก ===
  const employer1 = await prisma.user.upsert({
    where: { email: "chanin@rmutl.ac.th" },
    update: {},
    create: {
      email: "chanin@rmutl.ac.th",
      name: "ชนินทร์ ศรีสวัสดิ์",
      role: "employer",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      organization: "คณะวิศวกรรมศาสตร์ มทร.ล้านนา",
      org_address: "128 ถ.ห้วยแก้ว อ.เมือง จ.เชียงใหม่ 50300",
    },
  });

  const employer2 = await prisma.user.upsert({
    where: { email: "rattana@rmutl.ac.th" },
    update: {},
    create: {
      email: "rattana@rmutl.ac.th",
      name: "รัตนา จันทร์เพ็ญ",
      role: "employer",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      organization: "สำนักงานอธิการบดี มทร.ล้านนา",
      org_address: "128 ถ.ห้วยแก้ว อ.เมือง จ.เชียงใหม่ 50300",
    },
  });

  const employer3 = await prisma.user.upsert({
    where: { email: "surachai@doisaket.rmutl.ac.th" },
    update: {},
    create: {
      email: "surachai@doisaket.rmutl.ac.th",
      name: "สุรชัย ดอยสะเก็ด",
      role: "employer",
      campus: "doisaket",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      organization: "ฝ่ายอาคารสถานที่ วิทยาเขตดอยสะเก็ด",
      org_address: "อ.ดอยสะเก็ด จ.เชียงใหม่ 50220",
    },
  });

  const employer4 = await prisma.user.upsert({
    where: { email: "natthawut@cmsolar.co.th" },
    update: {},
    create: {
      email: "natthawut@cmsolar.co.th",
      name: "ณัฐวุฒิ พลังแสง",
      role: "employer",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      organization: "บริษัท เชียงใหม่โซลาร์ จำกัด",
      org_registration: "0505560012345",
      org_address: "99/1 ถ.เชียงใหม่-ลำปาง อ.เมือง จ.เชียงใหม่ 50000",
    },
  });

  const employer5 = await prisma.user.upsert({
    where: { email: "priya@lannacool.com" },
    update: {},
    create: {
      email: "priya@lannacool.com",
      name: "ปรียา ล้านนาเย็น",
      role: "employer",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      organization: "ล้านนาแอร์เซอร์วิส",
      org_registration: "0505570067890",
      org_address: "55 ถ.นิมมานเหมินท์ อ.เมือง จ.เชียงใหม่ 50200",
    },
  });

  // === Donors (2) ===
  const donor1 = await prisma.user.upsert({
    where: { email: "somsak.donor@gmail.com" },
    update: {},
    create: {
      email: "somsak.donor@gmail.com",
      name: "สมศักดิ์ เมตตาจิต",
      role: "donor",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      organization: "บุคคลทั่วไป",
    },
  });

  const donor2 = await prisma.user.upsert({
    where: { email: "donate@lannafoundation.org" },
    update: {},
    create: {
      email: "donate@lannafoundation.org",
      name: "มูลนิธิล้านนาเพื่อการศึกษา",
      role: "donor",
      campus: "huaykaew",
      is_active: true,
      email_verified: true,
      approval_status: "APPROVED",
      organization: "มูลนิธิล้านนาเพื่อการศึกษา",
      org_registration: "ม.น. 0505/2555",
    },
  });

  // === Students (10) — mix tier/credential ===
  const studentsData = [
    {
      email: "nattapon.s@rmutl.ac.th",
      name: "ณัฐพล สายฟ้า",
      campus: "huaykaew",
      student_id_card: "65120001",
      faculty: "วิศวกรรมไฟฟ้า",
      year_level: 3,
      wallet_address: "TN7eGo1gp6tRkxfJqVbqEYP7jGKZsqHQFg",
    },
    {
      email: "siriporn.s@rmutl.ac.th",
      name: "ศิริพร แสงดาว",
      campus: "huaykaew",
      student_id_card: "65120002",
      faculty: "วิศวกรรมไฟฟ้า",
      year_level: 3,
      wallet_address: "TKVSuH8ZxoL3V5RAqHPdMKzWkTbJMRqzMf",
    },
    {
      email: "wittaya.s@rmutl.ac.th",
      name: "วิทยา เครื่องดี",
      campus: "huaykaew",
      student_id_card: "66120003",
      faculty: "วิศวกรรมเครื่องกล",
      year_level: 2,
      wallet_address: "TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn",
    },
    {
      email: "kittipong.s@rmutl.ac.th",
      name: "กิตติพงศ์ ช่างเก่ง",
      campus: "huaykaew",
      student_id_card: "66120004",
      faculty: "วิศวกรรมเครื่องกล",
      year_level: 2,
      wallet_address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    },
    {
      email: "pranee.s@rmutl.ac.th",
      name: "ปราณี ใจสะอาด",
      campus: "doisaket",
      student_id_card: "65120005",
      faculty: "วิศวกรรมโยธา",
      year_level: 3,
      wallet_address: "TRzGxLqN5J8PxKdvM2QWjVFBjqAuJgLY9b",
    },
    {
      email: "supakit.s@rmutl.ac.th",
      name: "ศุภกิจ ลูกช่าง",
      campus: "doisaket",
      student_id_card: "66120006",
      faculty: "วิศวกรรมโยธา",
      year_level: 2,
      wallet_address: "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL",
    },
    {
      email: "anucha.s@rmutl.ac.th",
      name: "อนุชา ไฟฟ้าดี",
      campus: "huaykaew",
      student_id_card: "67120007",
      faculty: "วิศวกรรมไฟฟ้า",
      year_level: 1,
      wallet_address: "TJDENsfBJs4RFETt1NYrap1kyzVDKiVPHB",
    },
    {
      email: "mayuree.s@rmutl.ac.th",
      name: "มยุรี แอร์เย็น",
      campus: "huaykaew",
      student_id_card: "67120008",
      faculty: "วิศวกรรมเครื่องกล",
      year_level: 1,
      wallet_address: "TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW6",
    },
    {
      email: "somchai.s@rmutl.ac.th",
      name: "สมชาย ท่อดี",
      campus: "doisaket",
      student_id_card: "66120009",
      faculty: "วิศวกรรมโยธา",
      year_level: 2,
      wallet_address: "TVj3JqJsmcq2NJvASr7GBP4oaEKX6q3nfM",
    },
    {
      email: "napaporn.s@rmutl.ac.th",
      name: "นภาพร ช่างซ่อม",
      campus: "huaykaew",
      student_id_card: "65120010",
      faculty: "วิศวกรรมไฟฟ้า",
      year_level: 3,
      wallet_address: "TLyqzVGLV1srkB7dToLJJH1FEqJX6eBJYn",
    },
  ];

  const students: Record<string, any>[] = [];
  for (const s of studentsData) {
    const student = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        ...s,
        role: "student",
        is_active: true,
        email_verified: true,
        approval_status: "APPROVED",
        approved_by: admin1.id,
        approved_at: new Date("2026-04-01"),
      },
    });
    students.push(student);
  }

  console.log(`✅ Users: ${10 + 5 + 2 + 3 + 2 + 2 + 1 + 2} created\n`);

  // ----------------------------------------------------------
  // 2. STUDENT TIERS — mix ระดับ
  // ----------------------------------------------------------

  // students[0] ณัฐพล — certified (เก่งสุด, เป็น mentor ได้)
  // students[1] ศิริพร — certified
  // students[2-3] วิทยา, กิตติพงศ์ — apprentice
  // students[4] ปราณี — apprentice
  // students[5-9] ที่เหลือ — trainee

  const tierData = [
    { student_id: students[0].id, tier: "certified" as const, training_jobs_completed: 12, avg_mentor_score: 4.5, promoted_at: new Date("2026-02-15") },
    { student_id: students[1].id, tier: "certified" as const, training_jobs_completed: 10, avg_mentor_score: 4.3, promoted_at: new Date("2026-03-01") },
    { student_id: students[2].id, tier: "apprentice" as const, training_jobs_completed: 5, avg_mentor_score: 3.8, promoted_at: new Date("2026-03-15") },
    { student_id: students[3].id, tier: "apprentice" as const, training_jobs_completed: 4, avg_mentor_score: 3.6, promoted_at: new Date("2026-03-20") },
    { student_id: students[4].id, tier: "apprentice" as const, training_jobs_completed: 6, avg_mentor_score: 4.0, promoted_at: new Date("2026-03-10") },
    { student_id: students[5].id, tier: "trainee" as const, training_jobs_completed: 1, avg_mentor_score: 3.2 },
    { student_id: students[6].id, tier: "trainee" as const, training_jobs_completed: 0, avg_mentor_score: 0 },
    { student_id: students[7].id, tier: "trainee" as const, training_jobs_completed: 0, avg_mentor_score: 0 },
    { student_id: students[8].id, tier: "trainee" as const, training_jobs_completed: 2, avg_mentor_score: 3.5 },
    { student_id: students[9].id, tier: "trainee" as const, training_jobs_completed: 3, avg_mentor_score: 3.7 },
  ];

  for (const t of tierData) {
    await prisma.studentTier.upsert({
      where: { student_id: t.student_id },
      update: {},
      create: t,
    });
  }

  console.log("✅ Student Tiers: 10 created\n");

  // ----------------------------------------------------------
  // 3. STUDENT CREDENTIALS
  // ----------------------------------------------------------

  const credentialData = [
    // ณัฐพล — Level 4 (กรมฝีมือแรงงาน certified)
    { student_id: students[0].id, credential_level: "LEVEL_4" as const, certified_by: "DSD" as const, certified_by_user_id: teacher1.id, specialization: "ช่างไฟฟ้าภายในอาคาร ระดับ 1" },
    // ศิริพร — Level 3 (Teacher certified)
    { student_id: students[1].id, credential_level: "LEVEL_3" as const, certified_by: "RMUTL_TEACHER" as const, certified_by_user_id: teacher1.id, specialization: "ช่างไฟฟ้าภายในอาคาร" },
    // วิทยา — Level 2 (Project certified)
    { student_id: students[2].id, credential_level: "LEVEL_2" as const, certified_by: "PROJECT_BARAMEE" as const, certified_by_user_id: staff1.id, specialization: "ช่างซ่อมบำรุงเครื่องกล" },
    // กิตติพงศ์ — Level 2
    { student_id: students[3].id, credential_level: "LEVEL_2" as const, certified_by: "PROJECT_BARAMEE" as const, certified_by_user_id: staff1.id, specialization: "ช่างซ่อมบำรุงยานยนต์" },
    // ปราณี — Level 2
    { student_id: students[4].id, credential_level: "LEVEL_2" as const, certified_by: "PROJECT_BARAMEE" as const, certified_by_user_id: staff2.id, specialization: "ช่างโยธา" },
    // ที่เหลือ — Level 1 (Registered)
    { student_id: students[5].id, credential_level: "LEVEL_1" as const, certified_by: "SYSTEM" as const },
    { student_id: students[6].id, credential_level: "LEVEL_1" as const, certified_by: "SYSTEM" as const },
    { student_id: students[7].id, credential_level: "LEVEL_1" as const, certified_by: "SYSTEM" as const },
    { student_id: students[8].id, credential_level: "LEVEL_1" as const, certified_by: "SYSTEM" as const },
    { student_id: students[9].id, credential_level: "LEVEL_1" as const, certified_by: "SYSTEM" as const },
  ];

  for (const c of credentialData) {
    await prisma.studentCredential.create({ data: c });
  }

  console.log("✅ Student Credentials: 10 created\n");

  // ----------------------------------------------------------
  // 4. STUDENT QUALIFICATIONS
  // ----------------------------------------------------------

  const qualData = [
    { student_id: students[0].id, total_jobs: 12, avg_score: 4.5, success_rate: 0.92, badge_level: "ELITE" as const, max_job_value: 5000 },
    { student_id: students[1].id, total_jobs: 10, avg_score: 4.3, success_rate: 0.90, badge_level: "TRUSTED" as const, max_job_value: 4000 },
    { student_id: students[2].id, total_jobs: 5, avg_score: 3.8, success_rate: 0.80, badge_level: "BASIC" as const, max_job_value: 2000 },
    { student_id: students[3].id, total_jobs: 4, avg_score: 3.6, success_rate: 0.75, badge_level: "BASIC" as const, max_job_value: 2000 },
    { student_id: students[4].id, total_jobs: 6, avg_score: 4.0, success_rate: 0.83, badge_level: "BASIC" as const, max_job_value: 2500 },
    { student_id: students[5].id, total_jobs: 1, avg_score: 3.2, success_rate: 1.0, badge_level: "LOCKED" as const, max_job_value: 500 },
    { student_id: students[6].id, total_jobs: 0, avg_score: 0, success_rate: 0, badge_level: "LOCKED" as const, max_job_value: 0 },
    { student_id: students[7].id, total_jobs: 0, avg_score: 0, success_rate: 0, badge_level: "LOCKED" as const, max_job_value: 0 },
    { student_id: students[8].id, total_jobs: 2, avg_score: 3.5, success_rate: 1.0, badge_level: "LOCKED" as const, max_job_value: 800 },
    { student_id: students[9].id, total_jobs: 3, avg_score: 3.7, success_rate: 1.0, badge_level: "LOCKED" as const, max_job_value: 1000 },
  ];

  for (const q of qualData) {
    await prisma.studentQualification.upsert({
      where: { student_id: q.student_id },
      update: {},
      create: q,
    });
  }

  console.log("✅ Student Qualifications: 10 created\n");

  // ----------------------------------------------------------
  // 5. STUDENT AVAILABILITY
  // ----------------------------------------------------------

  for (let i = 0; i < students.length; i++) {
    const status = i < 3 ? "busy" : i < 7 ? "available" : "available";
    await prisma.studentAvailability.upsert({
      where: { student_id: students[i].id },
      update: {},
      create: {
        student_id: students[i].id,
        status: status as any,
        current_jobs: i < 3 ? 1 : 0,
        location: students[i].campus === "huaykaew" ? "อาคาร C3 มทร.ล้านนา" : "อาคารช่าง วิทยาเขตดอยสะเก็ด",
      },
    });
  }

  console.log("✅ Student Availability: 10 created\n");

  // ----------------------------------------------------------
  // 6. JOBS — ทุก status, ทุก mode, ทุก type
  // ----------------------------------------------------------

  const now = new Date();
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  // OPEN jobs (3) — Mode A, B, C
  const jobOpen1 = await prisma.job.create({
    data: {
      title: "ซ่อมระบบไฟฟ้าอาคาร C3 ชั้น 2",
      description: "ตรวจเช็คและซ่อมระบบไฟฟ้าที่ลัดวงจร จุดที่ 3 บริเวณห้อง C3-201",
      type: "PAID",
      job_category: "electrical",
      status: "OPEN",
      hiring_mode: "MODE_A",
      location: "อาคาร C3 ชั้น 2 ห้อง 201",
      campus: "huaykaew",
      pay_amount: 1500,
      deadline: daysFromNow(14),
      employer_id: employer1.id,
    },
  });

  const jobOpen2 = await prisma.job.create({
    data: {
      title: "ติดตั้งแอร์ห้องประชุมสำนักงานอธิการ",
      description: "ติดตั้งเครื่องปรับอากาศ Daikin 18000 BTU จำนวน 2 เครื่อง พร้อมเดินท่อ",
      type: "PAID",
      job_category: "hvac",
      status: "OPEN",
      hiring_mode: "MODE_B",
      location: "สำนักงานอธิการบดี ชั้น 3",
      campus: "huaykaew",
      pay_amount: 3000,
      deadline: daysFromNow(21),
      employer_id: employer2.id,
    },
  });

  const jobOpen3 = await prisma.job.create({
    data: {
      title: "ซ่อมรั้วโรงเรียนวิทยาเขตดอยสะเก็ด",
      description: "ซ่อมแซมรั้วเหล็กด้านทิศตะวันออก ยาวประมาณ 20 เมตร ที่ผุกร่อน",
      type: "VOLUNTEER",
      job_category: "general",
      status: "OPEN",
      hiring_mode: "MODE_C",
      location: "รั้วด้านทิศตะวันออก",
      campus: "doisaket",
      pay_amount: 0,
      deadline: daysFromNow(30),
      employer_id: employer3.id,
    },
  });

  // ASSIGNED jobs (2)
  const jobAssigned1 = await prisma.job.create({
    data: {
      title: "เปลี่ยนหลอดไฟ LED อาคารเรียน B1",
      description: "เปลี่ยนหลอดไฟ LED T8 จำนวน 30 หลอด ในห้องเรียน B1-101 ถึง B1-110",
      type: "PAID",
      job_category: "electrical",
      status: "ASSIGNED",
      hiring_mode: "MODE_A",
      location: "อาคาร B1 ชั้น 1",
      campus: "huaykaew",
      pay_amount: 800,
      deadline: daysFromNow(7),
      employer_id: employer1.id,
      student_id: students[2].id, // วิทยา (apprentice)
    },
  });

  const jobAssigned2 = await prisma.job.create({
    data: {
      title: "ฝึกซ่อมระบบแอร์เบื้องต้น (Training)",
      description: "ฝึกอบรมการล้างแอร์และเติมน้ำยา ภายใต้การดูแลของ mentor",
      type: "TRAINING",
      job_category: "hvac",
      status: "ASSIGNED",
      hiring_mode: "MODE_A",
      is_mentorship: true,
      location: "ห้องปฏิบัติการแอร์ อาคาร D2",
      campus: "huaykaew",
      pay_amount: 0,
      deadline: daysFromNow(10),
      employer_id: rmutlStaff1.id,
      student_id: students[7].id, // มยุรี (trainee)
      mentor_id: students[0].id, // ณัฐพล (certified, mentor)
    },
  });

  // CONFIRMED job (1)
  const jobConfirmed = await prisma.job.create({
    data: {
      title: "ซ่อมท่อน้ำรั่ว อาคารหอพัก",
      description: "ซ่อมท่อ PVC ที่แตกร้าวบริเวณห้องน้ำชั้น 2 หอพัก A",
      type: "PAID",
      job_category: "general",
      status: "CONFIRMED",
      hiring_mode: "MODE_A",
      location: "หอพัก A ชั้น 2",
      campus: "huaykaew",
      pay_amount: 600,
      deadline: daysFromNow(5),
      employer_id: employer1.id,
      student_id: students[3].id, // กิตติพงศ์ (apprentice)
    },
  });

  // IN_PROGRESS jobs (2) — 1 ปกติ + 1 mentorship
  const jobInProgress1 = await prisma.job.create({
    data: {
      title: "ติดตั้งระบบ Solar Cell อาคาร A1",
      description: "ติดตั้ง solar panel 10 แผง บนหลังคาอาคาร A1 พร้อม inverter",
      type: "PAID",
      job_category: "electrical",
      status: "IN_PROGRESS",
      hiring_mode: "MODE_A",
      location: "หลังคาอาคาร A1",
      campus: "huaykaew",
      pay_amount: 5000,
      deadline: daysFromNow(14),
      employer_id: employer4.id, // ภายนอก — เชียงใหม่โซลาร์
      student_id: students[0].id, // ณัฐพล (certified)
      eval_window_start: daysAgo(3),
      eval_window_end: daysFromNow(4),
    },
  });

  const jobInProgress2 = await prisma.job.create({
    data: {
      title: "ซ่อมบำรุงแอร์ประจำเดือน (Mentorship)",
      description: "ฝึกงานซ่อมบำรุงเครื่องปรับอากาศ 10 เครื่อง โดยมี mentor ดูแล",
      type: "TRAINING",
      job_category: "hvac",
      status: "IN_PROGRESS",
      hiring_mode: "MODE_A",
      is_mentorship: true,
      location: "อาคาร C1-C5",
      campus: "huaykaew",
      pay_amount: 0,
      deadline: daysFromNow(7),
      employer_id: rmutlStaff1.id,
      student_id: students[6].id, // อนุชา (trainee)
      mentor_id: students[1].id, // ศิริพร (certified, mentor)
      eval_window_start: daysAgo(5),
      eval_window_end: daysFromNow(2),
    },
  });

  // SUBMITTED job (1)
  const jobSubmitted = await prisma.job.create({
    data: {
      title: "เดินสายไฟระบบ LAN อาคาร B2",
      description: "เดินสาย CAT6 จำนวน 20 จุด จากห้อง server ไป B2 ชั้น 1-3",
      type: "PAID",
      job_category: "electrical",
      status: "SUBMITTED",
      hiring_mode: "MODE_A",
      location: "อาคาร B2",
      campus: "huaykaew",
      pay_amount: 2000,
      deadline: daysAgo(1),
      employer_id: employer2.id,
      student_id: students[1].id, // ศิริพร (certified)
      eval_window_start: daysAgo(10),
      eval_window_end: daysFromNow(4),
    },
  });

  // COMPLETED jobs (5) — มี evaluation + review แล้ว
  const completedJobsData = [
    {
      title: "ซ่อมระบบไฟส่องสว่างลานจอดรถ",
      description: "เปลี่ยนโคมไฟ LED ลานจอดรถด้านหลังอาคาร A2 จำนวน 8 ดวง",
      type: "PAID" as const, job_category: "electrical" as const,
      location: "ลานจอดรถ อาคาร A2", campus: "huaykaew",
      pay_amount: 2500, employer_id: employer1.id, student_id: students[0].id,
    },
    {
      title: "ซ่อมเครื่องปรับอากาศห้องสมุด",
      description: "ล้างคอยล์ + เติมน้ำยา R32 เครื่องปรับอากาศ Mitsubishi ห้องสมุดชั้น 1",
      type: "PAID" as const, job_category: "hvac" as const,
      location: "ห้องสมุด ชั้น 1", campus: "huaykaew",
      pay_amount: 1800, employer_id: employer2.id, student_id: students[1].id,
    },
    {
      title: "ซ่อมแซมอาคารฝึกช่าง ดอยสะเก็ด",
      description: "ซ่อมหลังคารั่ว + ทาสีผนังใหม่ อาคารฝึกช่าง",
      type: "VOLUNTEER" as const, job_category: "general" as const,
      location: "อาคารฝึกช่าง", campus: "doisaket",
      pay_amount: 0, employer_id: employer3.id, student_id: students[4].id,
    },
    {
      title: "ติดตั้งปลั๊กไฟห้อง Lab คอมพิวเตอร์",
      description: "เดินสายและติดตั้งปลั๊กไฟ 3 ขา จำนวน 40 จุด สำหรับห้อง Lab ใหม่",
      type: "PAID" as const, job_category: "electrical" as const,
      location: "ห้อง Lab คอมพิวเตอร์ อาคาร B3", campus: "huaykaew",
      pay_amount: 3500, employer_id: employer1.id, student_id: students[0].id,
    },
    {
      title: "ฝึกซ่อมรถยนต์เบื้องต้น (Training)",
      description: "ฝึกเปลี่ยนน้ำมันเครื่อง + ตรวจเช็คระบบเบรก",
      type: "TRAINING" as const, job_category: "automotive" as const,
      location: "โรงงานช่างยนต์", campus: "huaykaew",
      pay_amount: 0, employer_id: rmutlStaff1.id, student_id: students[3].id,
      mentor_id: students[0].id,
    },
  ];

  const completedJobs: any[] = [];
  for (const j of completedJobsData) {
    const job = await prisma.job.create({
      data: {
        ...j,
        status: "COMPLETED",
        hiring_mode: "MODE_A",
        is_mentorship: !!j.mentor_id,
        deadline: daysAgo(7),
        eval_window_start: daysAgo(14),
        eval_window_end: daysAgo(7),
      },
    });
    completedJobs.push(job);
  }

  // DISPUTED job (1)
  const jobDisputed = await prisma.job.create({
    data: {
      title: "ซ่อมปั๊มน้ำอาคาร D1",
      description: "ซ่อมปั๊มน้ำแรงดันสูงที่เสียหายจากไฟกระชาก",
      type: "PAID",
      job_category: "general",
      status: "DISPUTED",
      hiring_mode: "MODE_A",
      location: "ห้องปั๊มน้ำ อาคาร D1",
      campus: "huaykaew",
      pay_amount: 2000,
      deadline: daysAgo(3),
      employer_id: employer1.id,
      student_id: students[2].id, // วิทยา
    },
  });

  // CANCELLED job (1)
  await prisma.job.create({
    data: {
      title: "ทาสีห้องเรียน A3-301 (ยกเลิก)",
      description: "ทาสีห้องเรียน A3-301 ใหม่ — ยกเลิกเนื่องจากเลื่อนงบประมาณ",
      type: "PAID",
      job_category: "general",
      status: "CANCELLED",
      hiring_mode: "MODE_A",
      location: "อาคาร A3 ชั้น 3",
      campus: "huaykaew",
      pay_amount: 1200,
      deadline: daysAgo(5),
      employer_id: employer2.id,
    },
  });

  console.log("✅ Jobs: 16 created (3 OPEN, 2 ASSIGNED, 1 CONFIRMED, 2 IN_PROGRESS, 1 SUBMITTED, 5 COMPLETED, 1 DISPUTED, 1 CANCELLED)\n");

  // ----------------------------------------------------------
  // 7. EVALUATIONS — สำหรับ completed jobs
  // ----------------------------------------------------------

  const evalData = [
    { job_id: completedJobs[0].id, student_id: students[0].id, teacher_id: teacher1.id, sq: 4.5, ss: 4.5, st: 4.0, sto: 4.5 },
    { job_id: completedJobs[1].id, student_id: students[1].id, teacher_id: teacher2.id, sq: 4.0, ss: 4.5, st: 4.0, sto: 4.0 },
    { job_id: completedJobs[2].id, student_id: students[4].id, teacher_id: teacher3.id, sq: 3.5, ss: 4.0, st: 3.5, sto: 4.0 },
    { job_id: completedJobs[3].id, student_id: students[0].id, teacher_id: teacher1.id, sq: 5.0, ss: 4.5, st: 4.5, sto: 5.0 },
    { job_id: completedJobs[4].id, student_id: students[3].id, teacher_id: teacher2.id, sq: 3.5, ss: 3.0, st: 3.5, sto: 3.0 },
  ];

  for (const e of evalData) {
    const weighted = e.sq * 0.4 + e.ss * 0.3 + e.st * 0.2 + e.sto * 0.1;
    await prisma.evaluation.create({
      data: {
        job_id: e.job_id,
        student_id: e.student_id,
        teacher_id: e.teacher_id,
        score_quality: e.sq,
        score_skill: e.ss,
        score_time: e.st,
        score_tool: e.sto,
        weighted_score: Math.round(weighted * 100) / 100,
        eval_phase: "POST_WORK",
        comment: "ผลงานดี ตามมาตรฐาน",
      },
    });
  }

  console.log("✅ Evaluations: 5 created\n");

  // ----------------------------------------------------------
  // 8. REVIEWS — Employer + Student + Mentor
  // ----------------------------------------------------------

  // Employer reviews (ผู้ว่าจ้างให้คะแนนนักศึกษา)
  for (let i = 0; i < 4; i++) {
    const j = completedJobs[i];
    await prisma.employerReview.create({
      data: {
        job_id: j.id,
        employer_id: j.employer_id,
        student_id: j.student_id,
        score_quality: 4 + Math.floor(Math.random() * 2),
        score_punctuality: 3 + Math.floor(Math.random() * 3),
        score_attitude: 4 + Math.floor(Math.random() * 2),
        overall_rating: 4.0 + Math.random() * 0.8,
        eval_phase: "POST_WORK",
        comment: "ทำงานเรียบร้อยดี แนะนำ",
      },
    });
  }

  // Student reviews (นักศึกษาให้คะแนนผู้ว่าจ้าง)
  for (let i = 0; i < 3; i++) {
    const j = completedJobs[i];
    await prisma.studentReview.create({
      data: {
        job_id: j.id,
        student_id: j.student_id,
        employer_id: j.employer_id,
        score_clarity: 4 + Math.floor(Math.random() * 2),
        score_payment: 5,
        score_safety: 4 + Math.floor(Math.random() * 2),
        overall_rating: 4.2 + Math.random() * 0.6,
        eval_phase: "POST_WORK",
        comment: "ผู้ว่าจ้างอธิบายงานชัดเจน สถานที่ทำงานปลอดภัย",
      },
    });
  }

  // Mentor review (สำหรับ completed mentorship job)
  await prisma.mentorReview.create({
    data: {
      job_id: completedJobs[4].id,
      mentor_id: students[0].id, // ณัฐพล
      trainee_id: students[3].id, // กิตติพงศ์
      score_effort: 3,
      score_safety: 4,
      score_skill_dev: 3,
      weighted_score: 3.3,
      eval_phase: "POST_WORK",
      comment: "น้องขยันดี แต่ต้องระวังเรื่องความปลอดภัยเพิ่มเติม",
      recommend_promotion: false,
    },
  });

  console.log("✅ Reviews: 4 employer + 3 student + 1 mentor created\n");

  // ----------------------------------------------------------
  // 9. DONATION FUNDS
  // ----------------------------------------------------------

  await prisma.donationFund.create({
    data: {
      donor_id: donor1.id,
      amount: 10000,
      purpose: "สนับสนุนการฝึกช่างไฟฟ้า",
      is_restricted: true,
      restriction_note: "ใช้เฉพาะงานหมวดไฟฟ้า (electrical) เท่านั้น",
    },
  });

  await prisma.donationFund.create({
    data: {
      donor_id: donor2.id,
      amount: 50000,
      purpose: "สนับสนุนโครงการ SkillChain ทั่วไป",
      is_restricted: false,
    },
  });

  await prisma.donationFund.create({
    data: {
      donor_id: donor2.id,
      amount: 20000,
      purpose: "ทุนอุปกรณ์การเรียนช่าง วิทยาเขตดอยสะเก็ด",
      is_restricted: true,
      restriction_note: "ใช้เฉพาะวิทยาเขตดอยสะเก็ดเท่านั้น",
    },
  });

  console.log("✅ Donation Funds: 3 created (80,000 TRPB total)\n");

  // ----------------------------------------------------------
  // 10. BEHAVIOR LOGS — ตัวอย่าง
  // ----------------------------------------------------------

  await prisma.behaviorLog.create({
    data: {
      user_id: students[5].id, // ศุภกิจ
      job_id: jobDisputed.id,
      event_type: "late_submission",
      severity: "medium",
      description: "ส่งงานช้ากว่ากำหนด 2 วัน",
      penalty_applied: false,
    },
  });

  await prisma.behaviorLog.create({
    data: {
      user_id: students[8].id, // สมชาย
      event_type: "safety_warning",
      severity: "low",
      description: "ไม่สวมถุงมือขณะปฏิบัติงาน — ตักเตือนครั้งที่ 1",
      penalty_applied: false,
    },
  });

  console.log("✅ Behavior Logs: 2 created\n");

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------

  console.log("═══════════════════════════════════════════");
  console.log("🎉 Seed complete!");
  console.log("═══════════════════════════════════════════");
  console.log(`
  Users:          27 (10 students, 5 employers, 2 admins, 1 superadmin,
                      3 teachers, 2 project_staff, 2 rmutl_staff, 2 donors)
  Student Tiers:  10 (2 certified, 3 apprentice, 5 trainee)
  Credentials:    10 (1 Lv.4, 1 Lv.3, 3 Lv.2, 5 Lv.1)
  Jobs:           16 (ทุก status + ทุก mode + ทุก type)
  Evaluations:     5
  Reviews:         8 (4 employer, 3 student, 1 mentor)
  Donations:       3 (80,000 TRPB)
  Behavior Logs:   2
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
