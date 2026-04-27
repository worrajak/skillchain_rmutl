#!/usr/bin/env node
/**
 * Add `skc_` prefix to all SkillChain table names.
 *
 * Modes:
 *   --sql: process all SQL files in prisma/migrations/ (except 00_init_schema.sql)
 *   --code: process all .ts/.tsx files in src/
 *   --dry-run: show what would change without writing
 *
 * Usage:
 *   node scripts/add-skc-prefix.mjs --sql --dry-run
 *   node scripts/add-skc-prefix.mjs --sql
 *   node scripts/add-skc-prefix.mjs --code
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Tables that need skc_ prefix (excluding ones already prefixed or auth.* / supabase managed)
const TABLES = [
  // Core (from schema.prisma)
  "users", "jobs", "evaluations",
  "employer_reviews", "student_reviews", "mentor_reviews",
  "student_credentials", "student_qualifications", "student_tiers",
  "student_availability", "student_rating_summary", "employer_rating_summary",
  "notifications", "job_chat_rooms", "chat_messages", "chat_participants",
  "job_assignment_requests", "job_cancellation_requests", "job_agreements",
  "disputes", "approval_logs", "fee_config", "behavior_logs", "donation_funds",

  // Training system
  "training_courses", "training_enrollments", "training_attendance",

  // Jobs extensions
  "job_images", "job_safety_checks", "job_checkins",
  "work_instruction_templates",

  // Credentials & escrow
  "credential_level_config", "escrow_records",

  // Disputes
  "dispute_comments",

  // Equipment
  "equipment", "equipment_loans",

  // Government workflow
  "gov_projects", "activity_approvals", "gov_contracts", "gov_timesheets",
  "work_certifications", "disbursements", "official_documents", "gov_workflow_log",

  // SkillCredit (use shorter names since "skill_" is redundant with "skc_")
  // We'll handle these specifically below
  // skill_credit_balances → skc_credit_balances
  // skill_credit_transactions → skc_credit_transactions
  // skill_level_config → skc_level_config

  // Telegram
  "telegram_link_tokens",

  // Exemptions
  "exemptions",
];

// Special renames (full new name, not just prefix)
const SPECIAL_RENAMES = {
  "skill_credit_balances": "skc_credit_balances",
  "skill_credit_transactions": "skc_credit_transactions",
  "skill_level_config": "skc_level_config",
};

// Args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const doSql = args.includes("--sql");
const doCode = args.includes("--code");

if (!doSql && !doCode) {
  console.error("Usage: node scripts/add-skc-prefix.mjs [--sql|--code] [--dry-run]");
  process.exit(1);
}

/**
 * Build replacement map.
 * Key: original name (with word boundaries assumed)
 * Value: new name with skc_ prefix
 */
function buildReplacements() {
  const replacements = [];

  // Special renames first (longer/more specific patterns)
  for (const [from, to] of Object.entries(SPECIAL_RENAMES)) {
    replacements.push({ from, to });
  }

  // Then regular tables: name → skc_name
  for (const t of TABLES) {
    replacements.push({ from: t, to: `skc_${t}` });
  }

  // Sort by length descending (longest match first to avoid partial replacement)
  return replacements.sort((a, b) => b.from.length - a.from.length);
}

function processSqlContent(content) {
  const replacements = buildReplacements();
  let modified = content;
  const counts = {};

  for (const { from, to } of replacements) {
    // Match in contexts: TABLE name, FROM name, JOIN name, REFERENCES name, ON name, "name"
    // Use word boundary: not preceded/followed by alphanumeric or underscore
    // But also handle quoted identifiers: "users" → "skc_users"

    // Pattern 1: quoted "name"
    const quotedRegex = new RegExp(`"${from}"`, "g");
    const beforeQ = modified;
    modified = modified.replace(quotedRegex, `"${to}"`);
    if (beforeQ !== modified) counts[from] = (counts[from] || 0) + 1;

    // Pattern 2: unquoted identifier — must have word boundary AND not be already prefixed
    // (?<!\w)from(?!\w) — but JS regex needs to use lookbehind support (Node 18+ ok)
    const unquotedRegex = new RegExp(`(?<![\\w_])${from}(?![\\w_])`, "g");
    const beforeU = modified;
    modified = modified.replace(unquotedRegex, to);
    if (beforeU !== modified) counts[from] = (counts[from] || 0) + 1;
  }

  return { content: modified, counts };
}

function processCodeContent(content) {
  const replacements = buildReplacements();
  let modified = content;
  const counts = {};

  for (const { from, to } of replacements) {
    // Match patterns:
    // .from("users")
    // .from('users')
    // .schema("public").from("users")
    // table: "users"
    // "users" inside JSON-like strings

    const patterns = [
      { regex: new RegExp(`\\.from\\(["']${from}["']\\)`, "g"), repl: `.from("${to}")` },
      { regex: new RegExp(`\\.from\\(\`${from}\`\\)`, "g"), repl: `.from(\`${to}\`)` },
    ];

    for (const { regex, repl } of patterns) {
      const before = modified;
      modified = modified.replace(regex, repl);
      const matches = (before.match(regex) ?? []).length;
      if (matches > 0) counts[from] = (counts[from] || 0) + matches;
    }
  }

  return { content: modified, counts };
}

function findFiles(dir, extensions) {
  const result = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(full);
      } else if (extensions.some(e => entry.name.endsWith(e))) {
        result.push(full);
      }
    }
  }
  walk(dir);
  return result;
}

// ============ MAIN ============

let totalFiles = 0;
let modifiedFiles = 0;
const allCounts = {};

if (doSql) {
  const sqlDir = path.join(ROOT, "prisma/migrations");
  const sqlFiles = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith(".sql") && !f.startsWith("00_init") && !f.startsWith("diagnostic"))
    .map(f => path.join(sqlDir, f));

  console.log(`\n📂 Processing ${sqlFiles.length} SQL files...\n`);

  for (const file of sqlFiles) {
    totalFiles++;
    const content = fs.readFileSync(file, "utf-8");
    const { content: newContent, counts } = processSqlContent(content);

    if (newContent !== content) {
      modifiedFiles++;
      const fileName = path.basename(file);
      const totalChanges = Object.values(counts).reduce((a, b) => a + b, 0);
      console.log(`  ✏️  ${fileName} — ${totalChanges} changes`);

      for (const [k, v] of Object.entries(counts)) {
        allCounts[k] = (allCounts[k] || 0) + v;
      }

      if (!dryRun) {
        fs.writeFileSync(file, newContent);
      }
    } else {
      console.log(`  ⏭️  ${path.basename(file)} — no changes`);
    }
  }
}

if (doCode) {
  const srcDir = path.join(ROOT, "src");
  const codeFiles = findFiles(srcDir, [".ts", ".tsx"]);

  console.log(`\n📂 Processing ${codeFiles.length} TS/TSX files in src/...\n`);

  for (const file of codeFiles) {
    totalFiles++;
    const content = fs.readFileSync(file, "utf-8");
    const { content: newContent, counts } = processCodeContent(content);

    if (newContent !== content) {
      modifiedFiles++;
      const relPath = path.relative(ROOT, file);
      const totalChanges = Object.values(counts).reduce((a, b) => a + b, 0);
      console.log(`  ✏️  ${relPath} — ${totalChanges} changes`);

      for (const [k, v] of Object.entries(counts)) {
        allCounts[k] = (allCounts[k] || 0) + v;
      }

      if (!dryRun) {
        fs.writeFileSync(file, newContent);
      }
    }
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files scanned:  ${totalFiles}`);
console.log(`   Files modified: ${modifiedFiles}`);
console.log(`   ${dryRun ? "(DRY RUN — no files written)" : "(files written)"}`);
console.log(`\n   Top changes:`);

const sorted = Object.entries(allCounts).sort(([, a], [, b]) => b - a);
for (const [name, count] of sorted.slice(0, 15)) {
  console.log(`     ${name.padEnd(35)} ${count}`);
}
