/**
 * Seed demo users + demo data for capturing guide screenshots WITHOUT exposing
 * real names from production.
 *
 * Demo accounts (password Demo1234!):
 *   - demo-student@rmutl.ac.th        "นศ. ตัวอย่าง"
 *   - demo-employer@rmutl.ac.th       "ผู้จ้าง ตัวอย่าง"
 *   - demo-teacher@rmutl.ac.th        "อาจารย์ ตัวอย่าง"
 *   - demo-staff@rmutl.ac.th          "ใต้ร่มฯ ตัวอย่าง"
 *   - demo-rmutl@rmutl.ac.th          "มทร.ลน. ตัวอย่าง"
 *
 * Demo jobs (employer = ผู้จ้าง ตัวอย่าง):
 *   - "ตัวอย่างงาน — ติดตั้งหลอดไฟ LED" (PAID, electrical)
 *   - "ตัวอย่างงาน — ล้างแอร์ห้องเรียน" (PAID, hvac)
 *   - Both already approved + assigned to demo student
 */

import pg from "pg";
import bcrypt from "bcryptjs";

const PASSWORD = "Demo1234!";
const HASH = await bcrypt.hash(PASSWORD, 10);

const c = new pg.Client({
  host: "db.vkiofmhddlzffgzstoml.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Prach4843#*",
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const DEMOS = [
  {
    email: "demo-student@rmutl.ac.th",
    name: "นศ. ตัวอย่าง",
    role: "student",
    avatar: "https://i.pravatar.cc/150?img=51",
    extras: { faculty: "วิศวกรรมไฟฟ้า", year_level: 3, student_id_card: "65010100" },
  },
  {
    email: "demo-employer@rmutl.ac.th",
    name: "ผู้จ้าง ตัวอย่าง",
    role: "employer",
    avatar: "https://i.pravatar.cc/150?img=52",
    extras: { organization: "หน่วยงานตัวอย่าง" },
  },
  {
    email: "demo-teacher@rmutl.ac.th",
    name: "อาจารย์ ตัวอย่าง",
    role: "teacher",
    avatar: "https://i.pravatar.cc/150?img=53",
    extras: {},
  },
  {
    email: "demo-staff@rmutl.ac.th",
    name: "ใต้ร่มฯ ตัวอย่าง",
    role: "project_staff",
    avatar: "https://i.pravatar.cc/150?img=54",
    extras: { staff_position: "เจ้าหน้าที่ตัวอย่าง" },
  },
  {
    email: "demo-rmutl@rmutl.ac.th",
    name: "มทร.ลน. ตัวอย่าง",
    role: "rmutl_staff",
    avatar: "https://i.pravatar.cc/150?img=55",
    extras: {},
  },
];

const ids = {};

console.log("=== Seeding demo users ===");
for (const d of DEMOS) {
  // 1. Upsert to auth.users
  // First check if already exists
  const { rows: existing } = await c.query("SELECT id FROM auth.users WHERE email = $1", [d.email]);
  let userId;

  if (existing.length > 0) {
    userId = existing[0].id;
    await c.query(
      `UPDATE auth.users SET
        encrypted_password=$1,
        email_confirmed_at=COALESCE(email_confirmed_at,NOW()),
        updated_at=NOW(),
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, '')
      WHERE id=$2`,
      [HASH, userId],
    );
    console.log(`  [${d.role}] ${d.email} — reused ${userId.slice(0,8)}...`);
  } else {
    // Insert new auth.users + minimal fields
    const { rows } = await c.query(
      `INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, last_sign_in_at, is_sso_user, is_anonymous,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
        'authenticated', $1, $2, NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        $3::jsonb,
        NOW(), NOW(), NOW(), false, false,
        '', '', '', '', '', '', '', ''
      ) RETURNING id`,
      [d.email, HASH, JSON.stringify({ name: d.name })],
    );
    userId = rows[0].id;
    console.log(`  [${d.role}] ${d.email} — created ${userId.slice(0,8)}...`);
  }

  // 2. Upsert basic skc_users row first
  await c.query(
    `INSERT INTO skc_users (id, email, name, role, avatar_url, approval_status)
     VALUES ($1, $2, $3, $4, $5, 'APPROVED')
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       avatar_url = EXCLUDED.avatar_url,
       approval_status = 'APPROVED'`,
    [userId, d.email, d.name, d.role, d.avatar],
  );

  // 3. Set role-specific extras one by one (avoids dynamic SQL pitfalls)
  for (const [col, val] of Object.entries(d.extras)) {
    await c.query(`UPDATE skc_users SET ${col} = $1 WHERE id = $2`, [val, userId]);
  }
  ids[d.role] = userId;
}

console.log("\n=== Seeding demo jobs ===");
const employerId = ids.employer;
const studentId = ids.student;
const staffId = ids.project_staff;

// Wipe old demo jobs (by title prefix)
await c.query(`DELETE FROM skc_jobs WHERE title LIKE 'ตัวอย่างงาน%'`);

// Create 2 demo jobs in different states
const demoJobs = [
  {
    title: "ตัวอย่างงาน — ติดตั้งหลอดไฟ LED",
    description: "ติดตั้งหลอดไฟ LED ทดแทนหลอดเดิม 6 จุด · งานตัวอย่างสำหรับคู่มือ",
    type: "PAID", category: "electrical", status: "ASSIGNED",
    pay: 600, required_workers: 1,
  },
  {
    title: "ตัวอย่างงาน — ล้างแอร์ห้องเรียน 2 เครื่อง",
    description: "ล้างทำความสะอาดแอร์ผนัง 2 เครื่อง · ฝึกประสบการณ์จริง",
    type: "PAID", category: "hvac", status: "OPEN",
    pay: 800, required_workers: 1,
  },
];

for (const j of demoJobs) {
  const r = await c.query(
    `INSERT INTO skc_jobs (
      employer_id, ${j.status === "ASSIGNED" ? "student_id, approved_by_staff, staff_approval_at, work_start_date, work_end_date, schedule_confirmed," : ""}
      title, description, location, campus,
      type, job_category, status, pay_amount, required_workers, deadline,
      created_at, updated_at
    ) VALUES (
      $1, ${j.status === "ASSIGNED" ? "$2, $3, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', true," : ""}
      ${j.status === "ASSIGNED" ? "$4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()" : "$2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()"}
    ) RETURNING id`,
    j.status === "ASSIGNED"
      ? [employerId, studentId, staffId, j.title, j.description, "อาคารตัวอย่าง", "huaykaew", j.type, j.category, j.status, j.pay, j.required_workers, new Date(Date.now() + 7 * 86400000)]
      : [employerId, j.title, j.description, "อาคารตัวอย่าง", "huaykaew", j.type, j.category, j.status, j.pay, j.required_workers, new Date(Date.now() + 7 * 86400000)],
  );
  console.log(`  ${j.status}: ${j.title} (${r.rows[0].id.slice(0,8)}...)`);

  // For ASSIGNED job, also add to skc_job_workers
  if (j.status === "ASSIGNED") {
    await c.query(
      `INSERT INTO skc_job_workers (job_id, student_id, role, added_by) VALUES ($1, $2, 'LEAD', $3) ON CONFLICT DO NOTHING`,
      [r.rows[0].id, studentId, staffId],
    );
  }
}

// Add some TRPB balance to the demo student so the wallet screenshot is meaningful
await c.query(
  `INSERT INTO skc_trpb_balances (user_id, balance) VALUES ($1, 1500)
   ON CONFLICT (user_id) DO UPDATE SET balance = GREATEST(skc_trpb_balances.balance, 1500)`,
  [studentId],
);

console.log("\n✅ Demo seed complete");
console.log("Login with password:", PASSWORD);
for (const d of DEMOS) {
  console.log(`  ${d.email} (${d.name} — ${d.role})`);
}

await c.end();
