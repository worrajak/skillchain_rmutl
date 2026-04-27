#!/usr/bin/env node
/**
 * Fix embedded table/FK references in Supabase queries.
 *
 * Patterns to fix:
 *   :users(...)          → :skc_users(...)
 *   :jobs(...)           → :skc_jobs(...)
 *   users!fk_name        → skc_users!skc_fk_name
 *   table!constraint_name → skc_table!skc_constraint_name
 *
 * Note: This is run AFTER add-skc-prefix.mjs has handled .from("...") calls.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TABLES = [
  "users", "jobs", "evaluations",
  "employer_reviews", "student_reviews", "mentor_reviews",
  "student_credentials", "student_qualifications", "student_tiers",
  "student_availability", "student_rating_summary", "employer_rating_summary",
  "notifications", "job_chat_rooms", "chat_messages", "chat_participants",
  "job_assignment_requests", "job_cancellation_requests", "job_agreements",
  "disputes", "approval_logs", "fee_config", "behavior_logs", "donation_funds",
  "training_courses", "training_enrollments", "training_attendance",
  "job_images", "job_safety_checks", "job_checkins",
  "work_instruction_templates",
  "credential_level_config", "escrow_records",
  "dispute_comments",
  "equipment", "equipment_loans",
  "gov_projects", "activity_approvals", "gov_contracts", "gov_timesheets",
  "work_certifications", "disbursements", "official_documents", "gov_workflow_log",
  "telegram_link_tokens", "exemptions",
];

// Sort by length descending — longer matches first
const sortedTables = [...TABLES].sort((a, b) => b.length - a.length);

function processFile(content) {
  let modified = content;
  let changes = 0;

  for (const table of sortedTables) {
    // Pattern 1: :tablename(  →  :skc_tablename(
    // (negative lookbehind: not already prefixed with skc_)
    const re1 = new RegExp(`(?<!skc_):${table}\\(`, "g");
    const before1 = modified;
    modified = modified.replace(re1, `:skc_${table}(`);
    if (before1 !== modified) {
      const matches = (before1.match(re1) ?? []).length;
      changes += matches;
    }

    // Pattern 2: tablename!fk_constraint  →  skc_tablename!skc_fk_constraint
    // FK constraint pattern: table_column_fkey
    // We match "tablename!" (left side of FK reference) then handle "!fk_name" separately
    const re2 = new RegExp(`(?<!skc_)\\b${table}!`, "g");
    const before2 = modified;
    modified = modified.replace(re2, `skc_${table}!`);
    if (before2 !== modified) {
      const matches = (before2.match(re2) ?? []).length;
      changes += matches;
    }

    // Pattern 3: !table_column_fkey  →  !skc_table_column_fkey
    // Match "!table_" at the start of FK name
    const re3 = new RegExp(`(?<!skc_)!${table}_`, "g");
    const before3 = modified;
    modified = modified.replace(re3, `!skc_${table}_`);
    if (before3 !== modified) {
      const matches = (before3.match(re3) ?? []).length;
      changes += matches;
    }
  }

  return { content: modified, changes };
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

const dryRun = process.argv.includes("--dry-run");
const srcDir = path.join(ROOT, "src");
const codeFiles = findFiles(srcDir, [".ts", ".tsx"]);

console.log(`\n📂 Processing ${codeFiles.length} TS/TSX files...\n`);

let totalChanges = 0;
let modifiedFiles = 0;

for (const file of codeFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const { content: newContent, changes } = processFile(content);

  if (changes > 0) {
    modifiedFiles++;
    totalChanges += changes;
    const relPath = path.relative(ROOT, file);
    console.log(`  ✏️  ${relPath} — ${changes} changes`);

    if (!dryRun) {
      fs.writeFileSync(file, newContent);
    }
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files modified: ${modifiedFiles}`);
console.log(`   Total changes:  ${totalChanges}`);
console.log(`   ${dryRun ? "(DRY RUN — no files written)" : "(files written)"}`);
