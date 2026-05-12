// E2E test setup via direct Postgres
import pg from "pg";
import bcrypt from "bcryptjs";

const TEST_PASSWORD = "Test1234!";
const targetRoles = ["superadmin", "admin", "project_staff", "employer", "student", "teacher"];

const client = new pg.Client({
  host: "db.vkiofmhddlzffgzstoml.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Prach4843#*",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: users } = await client.query(
  `SELECT id, email, role, name, approval_status FROM skc_users ORDER BY role, email`
);

console.log("=== USERS IN skc_users ===");
for (const u of users) {
  console.log(`  [${u.role}] ${u.email}  (${u.name || "-"})  status=${u.approval_status}`);
}

// Pick one of each role
const picked = {};
for (const u of users) {
  if (targetRoles.includes(u.role) && !picked[u.role] && u.approval_status !== "REJECTED") {
    picked[u.role] = u;
  }
}

const hash = await bcrypt.hash(TEST_PASSWORD, 10);
console.log("\n=== TEST USERS (resetting passwords + APPROVED) ===");
for (const role of targetRoles) {
  const u = picked[role];
  if (!u) {
    console.log(`  [${role}] — NOT FOUND`);
    continue;
  }
  const r = await client.query(
    `UPDATE auth.users
     SET encrypted_password = $1,
         email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
         updated_at = NOW()
     WHERE id::text = $2
     RETURNING id, email`,
    [hash, u.id]
  );
  if (r.rowCount === 1) {
    await client.query(
      `UPDATE skc_users SET approval_status = 'APPROVED' WHERE id = $1`,
      [u.id]
    );
    console.log(`  [${role.padEnd(14)}] ${u.email.padEnd(30)} → password=${TEST_PASSWORD}  (id=${u.id.slice(0,8)}...)`);
  } else {
    console.log(`  [${role.padEnd(14)}] ${u.email} — auth.users row not found`);
  }
}

const { rows: pool } = await client.query(
  `SELECT user_id, balance, hold FROM skc_trpb_balances WHERE user_id = 'SYSTEM'`
);
console.log(`\nSYSTEM TRPB pool: ${pool[0]?.balance ?? "?"} (hold ${pool[0]?.hold ?? 0})`);

const { rows: jc } = await client.query(`SELECT COUNT(*)::int AS n FROM skc_jobs`);
console.log(`Total jobs: ${jc[0].n}`);

await client.end();
