import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyOwner } from "@/lib/telegram";

/**
 * GET /api/cron/pending-actions-summary
 *
 * Daily summary of "who should do what" — sent to the admin Telegram chat
 * so the operator can chase pending work during system testing.
 *
 * Triggered by an external scheduler (Vercel Cron, GitHub Actions, etc.).
 * Default cadence: daily 09:00 ICT.
 *
 * Auth: pass `?secret=<CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.
 *
 * Vercel Cron config (vercel.json):
 *   { "crons": [{ "path": "/api/cron/pending-actions-summary?secret=…", "schedule": "0 2 * * *" }] }
 *   (cron expression in UTC — 02:00 UTC = 09:00 ICT)
 *
 * Manual test:
 *   curl "$NEXT_PUBLIC_APP_URL/api/cron/pending-actions-summary?secret=$CRON_SECRET"
 */
export async function GET(req: NextRequest) {
  // === Auth ===
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const fromQuery = req.nextUrl.searchParams.get("secret");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (fromQuery !== secret && fromHeader !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const now = new Date();

  // === Query stuck/pending work ===
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const halfDayAgo = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();

  // 1) Jobs awaiting staff review > 24h
  const { data: pendingReview } = await supabase
    .from("skc_jobs")
    .select("id, title, created_at, employer:skc_users!skc_jobs_employer_id_fkey(name)")
    .eq("status", "PENDING_REVIEW")
    .lt("created_at", dayAgo)
    .order("created_at", { ascending: true })
    .limit(10);

  // 2) Pending student assignment requests > 24h
  const { data: pendingApps } = await supabase
    .from("skc_job_assignment_requests")
    .select("id, created_at, job:skc_jobs(id, title), student:skc_users!skc_job_assignment_requests_student_id_fkey(name)")
    .eq("status", "PENDING")
    .lt("created_at", dayAgo)
    .order("created_at", { ascending: true })
    .limit(10);

  // 3) Submitted jobs awaiting confirmation > 12h
  const { data: awaitingConfirm } = await supabase
    .from("skc_jobs")
    .select("id, title, staff_confirmed_completion, employer_confirmed_completion, updated_at")
    .eq("status", "SUBMITTED")
    .lt("updated_at", halfDayAgo)
    .order("updated_at", { ascending: true })
    .limit(10);

  // 4) Completed jobs with unpaid escrow > 24h
  const { data: unpaidJobs } = await supabase
    .from("skc_jobs")
    .select("id, title, pay_amount, updated_at")
    .eq("status", "COMPLETED")
    .eq("type", "PAID")
    .is("escrow_tx", null)
    .gt("pay_amount", 0)
    .lt("updated_at", dayAgo)
    .order("updated_at", { ascending: true })
    .limit(10);

  // 5) Unsupervised in-progress jobs (no approved_by_staff)
  const { data: unsupervised } = await supabase
    .from("skc_jobs")
    .select("id, title, status, updated_at")
    .in("status", ["OPEN", "ASSIGNED", "CONFIRMED", "IN_PROGRESS"])
    .is("approved_by_staff", null)
    .order("updated_at", { ascending: true })
    .limit(10);

  // 6) Pending user approvals
  const { data: pendingUsers } = await supabase
    .from("skc_users")
    .select("id, name, role, created_at")
    .eq("approval_status", "PENDING")
    .lt("created_at", dayAgo)
    .order("created_at", { ascending: true })
    .limit(10);

  // 7) Open disputes
  const { data: openDisputes } = await supabase
    .from("skc_disputes")
    .select("id, category, description, created_at")
    .eq("status", "OPEN")
    .order("created_at", { ascending: true })
    .limit(10);

  // === Format summary ===
  const sections: string[] = [];
  const totalStuck =
    (pendingReview?.length ?? 0) +
    (pendingApps?.length ?? 0) +
    (awaitingConfirm?.length ?? 0) +
    (unpaidJobs?.length ?? 0) +
    (unsupervised?.length ?? 0) +
    (pendingUsers?.length ?? 0) +
    (openDisputes?.length ?? 0);

  if (totalStuck === 0) {
    await notifyOwner(`☀️ <b>สรุปงานค้าง — เช้านี้</b>\n\n✅ ไม่มีงานค้าง · ทุกอย่างเดินหน้าตามปกติ`);
    return NextResponse.json({ ok: true, stuck: 0 });
  }

  sections.push(`☀️ <b>สรุปงานค้าง — เช้านี้ (${now.toLocaleDateString("th-TH")})</b>`);
  sections.push(`รวม <b>${totalStuck}</b> รายการต้องดูแล:`);
  sections.push("");

  if (pendingReview && pendingReview.length > 0) {
    sections.push(`🟠 <b>งานรอ Staff อนุมัติ (${pendingReview.length})</b> — เกิน 24 ชม.`);
    for (const j of pendingReview.slice(0, 5)) {
      const emp = Array.isArray(j.employer) ? j.employer[0] : j.employer;
      const hrs = Math.floor((Date.now() - new Date(j.created_at).getTime()) / 3600000);
      sections.push(`   • ${esc(j.title)} · ผู้จ้าง: ${esc(emp?.name ?? "-")} · ${hrs}h`);
    }
    if (pendingReview.length > 5) sections.push(`   … +${pendingReview.length - 5} more`);
    sections.push("");
  }

  if (pendingApps && pendingApps.length > 0) {
    sections.push(`👥 <b>คำขอ นศ. รอ approve (${pendingApps.length})</b> — เกิน 24 ชม.`);
    for (const a of pendingApps.slice(0, 5)) {
      const job = Array.isArray(a.job) ? a.job[0] : a.job;
      const stu = Array.isArray(a.student) ? a.student[0] : a.student;
      const hrs = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 3600000);
      sections.push(`   • ${esc(stu?.name ?? "-")} → ${esc(job?.title ?? "-")} · ${hrs}h`);
    }
    if (pendingApps.length > 5) sections.push(`   … +${pendingApps.length - 5} more`);
    sections.push("");
  }

  if (awaitingConfirm && awaitingConfirm.length > 0) {
    sections.push(`🟡 <b>นศ. ส่งงานแล้ว รอตรวจ (${awaitingConfirm.length})</b> — เกิน 12 ชม.`);
    for (const j of awaitingConfirm.slice(0, 5)) {
      const who: string[] = [];
      if (!j.staff_confirmed_completion) who.push("Staff");
      if (!j.employer_confirmed_completion) who.push("ผู้จ้าง");
      sections.push(`   • ${esc(j.title)} · รอ: ${who.join(" + ")}`);
    }
    if (awaitingConfirm.length > 5) sections.push(`   … +${awaitingConfirm.length - 5} more`);
    sections.push("");
  }

  if (unpaidJobs && unpaidJobs.length > 0) {
    sections.push(`💰 <b>งานเสร็จแล้ว รอจ่าย TRPB (${unpaidJobs.length})</b>`);
    for (const j of unpaidJobs.slice(0, 5)) {
      sections.push(`   • ${esc(j.title)} · ${Number(j.pay_amount).toLocaleString()} TRPB`);
    }
    if (unpaidJobs.length > 5) sections.push(`   … +${unpaidJobs.length - 5} more`);
    sections.push("");
  }

  if (unsupervised && unsupervised.length > 0) {
    sections.push(`🆘 <b>งานไม่มีผู้กำกับ (${unsupervised.length})</b>`);
    for (const j of unsupervised.slice(0, 5)) {
      sections.push(`   • ${esc(j.title)} · สถานะ: ${j.status}`);
    }
    if (unsupervised.length > 5) sections.push(`   … +${unsupervised.length - 5} more`);
    sections.push("");
  }

  if (pendingUsers && pendingUsers.length > 0) {
    sections.push(`👤 <b>บัญชีรอ admin อนุมัติ (${pendingUsers.length})</b>`);
    for (const u of pendingUsers.slice(0, 5)) {
      sections.push(`   • ${esc(u.name ?? "-")} (${u.role})`);
    }
    if (pendingUsers.length > 5) sections.push(`   … +${pendingUsers.length - 5} more`);
    sections.push("");
  }

  if (openDisputes && openDisputes.length > 0) {
    sections.push(`⚖️ <b>ข้อพิพาทเปิดอยู่ (${openDisputes.length})</b>`);
    for (const d of openDisputes.slice(0, 5)) {
      sections.push(`   • ${esc(d.category)}: ${esc(d.description.slice(0, 50))}…`);
    }
    if (openDisputes.length > 5) sections.push(`   … +${openDisputes.length - 5} more`);
    sections.push("");
  }

  const msg = sections.join("\n");
  const ok = await notifyOwner(msg, "/admin/dashboard");

  return NextResponse.json({
    ok,
    stuck: totalStuck,
    breakdown: {
      pendingReview: pendingReview?.length ?? 0,
      pendingApps: pendingApps?.length ?? 0,
      awaitingConfirm: awaitingConfirm?.length ?? 0,
      unpaidJobs: unpaidJobs?.length ?? 0,
      unsupervised: unsupervised?.length ?? 0,
      pendingUsers: pendingUsers?.length ?? 0,
      openDisputes: openDisputes?.length ?? 0,
    },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}
