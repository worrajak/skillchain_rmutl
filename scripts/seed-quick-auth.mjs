#!/usr/bin/env node
/**
 * Generate PIN + QR Token for all existing users.
 *
 * Output:
 *   - Console table with email, role, PIN, QR token, QR URL
 *   - Saves to: /tmp/skillchain-pins-<timestamp>.csv (for staff distribution)
 *
 * Usage:
 *   node scripts/seed-quick-auth.mjs              # all users
 *   node scripts/seed-quick-auth.mjs --staff-only # only admin/teacher/staff
 *   node scripts/seed-quick-auth.mjs --force      # regenerate even if PIN exists
 */

import { Client } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ============ Load env ============

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const result = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const env = { ...readEnvFile(path.join(ROOT, ".env")), ...readEnvFile(path.join(ROOT, ".env.local")) };
const dbUrl = env.DIRECT_URL || env.DATABASE_URL;
const m = dbUrl.match(/^postgresql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/([^?]+)/);
if (!m) { console.error("❌ Failed to parse DB URL"); process.exit(1); }

const config = {
  user: m[1], password: m[2], host: m[3], port: parseInt(m[4]),
  database: m[5], ssl: { rejectUnauthorized: false },
};

const APP_URL = env.NEXT_PUBLIC_APP_URL || "https://skillchain-rmutl.vercel.app";

// ============ Generators ============

function generatePin() {
  let pin = "";
  for (let i = 0; i < 6; i++) pin += Math.floor(Math.random() * 10).toString();
  return pin;
}

function generateQrToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) result += chars[bytes[i] % chars.length];
  return result;
}

// ============ Args ============

const args = process.argv.slice(2);
const staffOnly = args.includes("--staff-only");
const force = args.includes("--force");

// ============ Main ============

const client = new Client(config);
await client.connect();
console.log(`\n🔌 Connected\n`);

// Fetch users
const filter = staffOnly
  ? `role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')`
  : `role != 'donor'`;

const { rows: users } = await client.query(`
  SELECT id, email, name, role
  FROM public.skc_users
  WHERE ${filter} AND COALESCE(quick_auth_enabled, true) = true
  ORDER BY role, email
`);

console.log(`📋 Found ${users.length} users to process\n`);

const results = [];
let created = 0;
let skipped = 0;
let regenerated = 0;

for (const user of users) {
  // Check existing PIN
  const { rows: existing } = await client.query(
    `SELECT user_id FROM public.skc_user_pins WHERE user_id = $1`,
    [user.id]
  );

  let pin, action;

  if (existing.length > 0 && !force) {
    skipped++;
    action = "skipped";
    pin = "(existing)";
  } else {
    pin = generatePin();
    const hash = await bcrypt.hash(pin, 10);

    if (existing.length > 0) {
      await client.query(
        `UPDATE public.skc_user_pins
         SET pin_hash = $1, pin_set_at = NOW(), failed_attempts = 0, locked_until = NULL
         WHERE user_id = $2`,
        [hash, user.id]
      );
      regenerated++;
      action = "regenerated";
    } else {
      await client.query(
        `INSERT INTO public.skc_user_pins (user_id, pin_hash) VALUES ($1, $2)`,
        [user.id, hash]
      );
      created++;
      action = "created";
    }
  }

  // Ensure QR token
  const { rows: qrRows } = await client.query(
    `SELECT qr_token FROM public.skc_user_qr_tokens WHERE user_id = $1 AND is_active = true AND revoked_at IS NULL`,
    [user.id]
  );

  let qrToken;
  if (qrRows.length > 0) {
    qrToken = qrRows[0].qr_token;
  } else {
    qrToken = generateQrToken();
    await client.query(
      `INSERT INTO public.skc_user_qr_tokens (user_id, qr_token, is_active) VALUES ($1, $2, true)`,
      [user.id, qrToken]
    );
  }

  results.push({
    email: user.email,
    name: user.name,
    role: user.role,
    pin,
    qr_token: qrToken,
    qr_url: `${APP_URL}/quick-login?qr=${qrToken}`,
    action,
  });
}

console.log(`\n📊 Summary:`);
console.log(`   New PINs created:   ${created}`);
console.log(`   Regenerated:        ${regenerated}`);
console.log(`   Skipped (exists):   ${skipped}`);
console.log(`   Total processed:    ${results.length}\n`);

// Save to CSV
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const csvPath = `/tmp/skillchain-pins-${timestamp}.csv`;
const csvHeader = "Email,Name,Role,PIN,QR Token,QR URL,Action\n";
const csvBody = results
  .map(r => [r.email, r.name, r.role, r.pin, r.qr_token, r.qr_url, r.action]
    .map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`)
    .join(","))
  .join("\n");
fs.writeFileSync(csvPath, csvHeader + csvBody);

console.log(`💾 Saved: ${csvPath}\n`);

// Print to console
console.table(results.map(r => ({
  email: r.email,
  role: r.role,
  pin: r.pin,
  qr_token: r.qr_token,
  action: r.action,
})));

console.log(`\n📌 To distribute: open the CSV file and send PIN + QR to each user.`);
console.log(`   ⚠️  PIN is in plaintext only here — DB stores bcrypt hash.\n`);

await client.end();
