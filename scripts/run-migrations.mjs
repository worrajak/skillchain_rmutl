#!/usr/bin/env node
/**
 * Run SQL migrations directly via pg client (bypass Prisma).
 *
 * Reason: Prisma introspects entire public schema and conflicts with
 * other projects' tables in the same Supabase project. Running raw SQL
 * with skc_ prefix avoids any conflict.
 *
 * Usage:
 *   node scripts/run-migrations.mjs              # run all in order
 *   node scripts/run-migrations.mjs <file.sql>   # run single file
 */

import { Client } from "pg";
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

if (!dbUrl) {
  console.error("❌ DIRECT_URL or DATABASE_URL not found in .env.local");
  process.exit(1);
}

// Parse URL
const m = dbUrl.match(/^postgresql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/([^?]+)/);
if (!m) {
  console.error("❌ Failed to parse DATABASE_URL");
  process.exit(1);
}

const config = {
  user: m[1],
  password: m[2],
  host: m[3],
  port: parseInt(m[4]),
  database: m[5],
  ssl: { rejectUnauthorized: false },
};

console.log(`\n🔌 Connecting to ${config.host}:${config.port}/${config.database} as ${config.user}...`);

// ============ Migration order ============

const MIGRATION_ORDER = [
  "00_init_schema.sql",
  "manual_avatar_url.sql",
  "manual_job_review.sql",
  "manual_training_system.sql",
  "manual_add_job_assignment_requests.sql",
  "manual_job_images_and_quota.sql",
  "manual_schema_drift_fix.sql",
  "manual_schema_drift_fix_v2.sql",
  "manual_telegram.sql",
  "manual_qr_pdpa.sql",
  "manual_rls_policies.sql",
  "manual_government_workflow.sql",
  "manual_government_workflow_triggers.sql",
  "manual_skill_credits.sql",
  // fix_user_sync.sql is run separately (has multiple sections)
];

// ============ Run migrations ============

async function runMigration(client, fileName) {
  const filePath = path.join(ROOT, "prisma/migrations", fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${fileName} — file not found, skipping`);
    return { ok: true, skipped: true };
  }

  const sql = fs.readFileSync(filePath, "utf-8");
  process.stdout.write(`  ⏳ ${fileName.padEnd(45)} `);

  try {
    await client.query(sql);
    console.log("✅");
    return { ok: true };
  } catch (err) {
    // Some errors are OK (e.g., "already exists")
    const msg = err.message;
    if (
      msg.includes("already exists") ||
      msg.includes("duplicate object") ||
      msg.includes("duplicate_object")
    ) {
      console.log("⏭  (already exists)");
      return { ok: true, warning: msg };
    }
    console.log("❌");
    console.error(`     Error: ${msg}`);
    return { ok: false, error: msg };
  }
}

// ============ Main ============

const client = new Client(config);

try {
  await client.connect();
  console.log("✅ Connected\n");

  // Single file mode
  const arg = process.argv[2];
  if (arg) {
    console.log(`📄 Running single file: ${arg}\n`);
    const result = await runMigration(client, arg);
    if (!result.ok) process.exit(1);
    await client.end();
    process.exit(0);
  }

  // Run all in order
  console.log(`📂 Running ${MIGRATION_ORDER.length} migrations in order:\n`);

  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (const file of MIGRATION_ORDER) {
    const result = await runMigration(client, file);
    if (result.ok) succeeded++;
    else {
      failed++;
      errors.push({ file, error: result.error });
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Succeeded: ${succeeded}/${MIGRATION_ORDER.length}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`\nErrors:`);
    for (const e of errors) {
      console.log(`  ${e.file}: ${e.error}`);
    }
  }

  // Verify by counting skc_ tables
  const verifyResult = await client.query(`
    SELECT COUNT(*) AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'skc_%'
  `);
  console.log(`\n🎯 SkillChain tables created: ${verifyResult.rows[0].count}`);

  await client.end();
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error("❌ Fatal error:", err.message);
  await client.end().catch(() => {});
  process.exit(1);
}
