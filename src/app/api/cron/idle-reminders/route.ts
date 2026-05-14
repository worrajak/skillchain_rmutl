import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyOwner, notifyViaTelegram, createNotification } from "@/lib/telegram";

/**
 * GET /api/cron/idle-reminders
 *
 * Tap-on-shoulder reminders ระหว่างวัน — แตกต่างจาก daily summary ตรงที่:
 *   • ส่งให้ admin **และ** next actor (คนที่ค้าง) ทั้งคู่
 *   • ส่ง deep link ตรงไปหน้าที่ต้องกดทำ — actor act ได้ทันที
 *   • Dedupe via `skc_idle_reminders_sent` — กัน ping ซ้ำใน 12 ชม.
 *
 * Cron schedule (vercel.json): `0 1-13/2 * * *` = 08:00, 10:00, ..., 20:00 ICT
 *
 * Auth: ?secret=$CRON_SECRET หรือ Bearer header.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
const DEDUPE_WINDOW_HOURS = 12;

type Kind =
  | "pending_review"
  | "pending_apps"
  | "schedule_employer"
  | "schedule_student"
  | "submitted_staff"
  | "submitted_employer"
  | "unpaid_escrow"
  | "unsupervised";

interface PingPlan {
  jobId: string;
  jobTitle: string;
  kind: Kind;
  hoursStuck: number;
  adminText: string;            // ส่งเข้า OWNER_CHAT_ID
  adminLink: string;            // /admin/jobs?id=xxx
  recipients: Array<{           // next actors
    userId: string;
    title: string;
    body: string;
    link: string;
  }>;
}

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
  const now = Date.now();
  const dedupeSince = new Date(now - DEDUPE_WINDOW_HOURS * 3600 * 1000).toISOString();

  const plans: PingPlan[] = [];

  // === Detect stuck cases (each block returns a list of PingPlan) ===
  await scanPendingReview(supabase, now, plans);
  await scanPendingApps(supabase, now, plans);
  await scanSchedule(supabase, now, plans);
  await scanSubmitted(supabase, now, plans);
  await scanUnpaidEscrow(supabase, now, plans);
  await scanUnsupervised(supabase, now, plans);

  // === Dedupe — drop plans that were already pinged within last DEDUPE_WINDOW ===
  const dedupeKeys = plans.map((p) => `${p.jobId}::${p.kind}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: alreadySent } = await (supabase as any)
    .from("skc_idle_reminders_sent")
    .select("job_id, kind")
    .gt("sent_at", dedupeSince);
  const sentKeys = new Set(
    (alreadySent ?? []).map((r: { job_id: string; kind: string }) => `${r.job_id}::${r.kind}`),
  );
  const fresh = plans.filter((_, i) => !sentKeys.has(dedupeKeys[i]));

  // === Send pings + record dedupe rows ===
  for (const plan of fresh) {
    // 1) Admin owner
    try {
      await notifyOwner(plan.adminText, plan.adminLink);
    } catch {
      // best-effort
    }

    // 2) Each next actor — DB notification + Telegram via their chat_id
    for (const r of plan.recipients) {
      await createNotification(supabase, {
        user_id: r.userId,
        type: "idle_reminder",
        title: r.title,
        body: r.body,
        link: r.link,
      }).catch(() => {});
    }

    // 3) Dedupe row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("skc_idle_reminders_sent").insert({
      job_id: plan.jobId,
      kind: plan.kind,
    });
  }

  return NextResponse.json({
    ok: true,
    scanned: plans.length,
    fresh: fresh.length,
    skipped_dedupe: plans.length - fresh.length,
    breakdown: countByKind(fresh),
  });
}

function countByKind(plans: PingPlan[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const p of plans) m[p.kind] = (m[p.kind] ?? 0) + 1;
  return m;
}

function hours(ms: number) {
  return Math.floor(ms / 3600000);
}

function esc(s: string): string {
  return (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

// =============================================================
// Scanners — each pushes PingPlan into accumulator
// =============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanPendingReview(supabase: any, now: number, plans: PingPlan[]) {
  const threshold = new Date(now - 4 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("skc_jobs")
    .select("id, title, created_at")
    .eq("status", "PENDING_REVIEW")
    .lt("created_at", threshold);

  if (!data || data.length === 0) return;

  // All staff/admin to notify
  const { data: staff } = await supabase
    .from("skc_users")
    .select("id")
    .in("role", ["project_staff", "rmutl_staff", "admin", "superadmin", "teacher"])
    .eq("approval_status", "APPROVED");
  const staffIds = (staff ?? []).map((s: { id: string }) => s.id);

  for (const j of data) {
    const h = hours(now - new Date(j.created_at).getTime());
    plans.push({
      jobId: j.id,
      jobTitle: j.title,
      kind: "pending_review",
      hoursStuck: h,
      adminText: `⏰ <b>งานรอ Staff อนุมัติ ${h} ชม.</b>\n💼 ${esc(j.title)}\n👉 ต้องพิจารณา`,
      adminLink: `/admin/jobs?id=${j.id}`,
      recipients: staffIds.map((id: string) => ({
        userId: id,
        title: `⏰ งานรอคุณอนุมัติ (${h} ชม.)`,
        body: `งาน "${j.title}" รอ staff พิจารณา — กดเปิดหน้าอนุมัติด้านล่าง`,
        link: `/project-staff/review-jobs`,
      })),
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanPendingApps(supabase: any, now: number, plans: PingPlan[]) {
  const threshold = new Date(now - 4 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("skc_job_assignment_requests")
    .select("id, job_id, created_at, job:skc_jobs(id, title), student:skc_users!skc_job_assignment_requests_student_id_fkey(name)")
    .eq("status", "PENDING")
    .lt("created_at", threshold);

  if (!data || data.length === 0) return;

  const { data: staff } = await supabase
    .from("skc_users")
    .select("id")
    .in("role", ["project_staff", "rmutl_staff", "admin", "superadmin"])
    .eq("approval_status", "APPROVED");
  const staffIds = (staff ?? []).map((s: { id: string }) => s.id);

  // Group by job to avoid one job spamming multiple times
  const byJob = new Map<string, { job_id: string; title: string; count: number; oldest: string }>();
  for (const a of data) {
    const job = Array.isArray(a.job) ? a.job[0] : a.job;
    if (!job) continue;
    const cur = byJob.get(a.job_id);
    if (cur) {
      cur.count += 1;
      if (a.created_at < cur.oldest) cur.oldest = a.created_at;
    } else {
      byJob.set(a.job_id, { job_id: a.job_id, title: job.title, count: 1, oldest: a.created_at });
    }
  }

  for (const [jobId, v] of byJob) {
    const h = hours(now - new Date(v.oldest).getTime());
    plans.push({
      jobId,
      jobTitle: v.title,
      kind: "pending_apps",
      hoursStuck: h,
      adminText: `⏰ <b>คำขอ นศ. รอ approve ${h} ชม.</b>\n💼 ${esc(v.title)}\n👥 ${v.count} คำขอ`,
      adminLink: `/admin/jobs?id=${jobId}`,
      recipients: staffIds.map((id: string) => ({
        userId: id,
        title: `⏰ ${v.count} คำขอรอคุณ approve (${h} ชม.)`,
        body: `งาน "${v.title}" — กดเปิดหน้า approve ด้านล่าง`,
        link: `/project-staff/approvals`,
      })),
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanSchedule(supabase: any, now: number, plans: PingPlan[]) {
  const threshold = new Date(now - 6 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("skc_jobs")
    .select("id, title, status, schedule_proposed_by, schedule_confirmed, employer_id, student_id, updated_at")
    .eq("status", "ASSIGNED")
    .eq("schedule_confirmed", false)
    .not("schedule_proposed_by", "is", null)
    .lt("updated_at", threshold);

  if (!data || data.length === 0) return;

  for (const j of data) {
    const h = hours(now - new Date(j.updated_at).getTime());
    // The party who didn't propose = the one we ping
    const proposedByStudent = j.schedule_proposed_by === j.student_id;
    const otherPartyId = proposedByStudent ? j.employer_id : j.student_id;
    const otherPartyKind: Kind = proposedByStudent ? "schedule_employer" : "schedule_student";
    const otherLink = proposedByStudent
      ? `/employer/jobs/${j.id}`
      : `/student/dashboard`;

    if (!otherPartyId) continue;

    plans.push({
      jobId: j.id,
      jobTitle: j.title,
      kind: otherPartyKind,
      hoursStuck: h,
      adminText: `⏰ <b>รอ${proposedByStudent ? "ผู้จ้าง" : "นศ."}ยืนยันวันทำงาน ${h} ชม.</b>\n💼 ${esc(j.title)}`,
      adminLink: `/admin/jobs?id=${j.id}`,
      recipients: [{
        userId: otherPartyId,
        title: `⏰ รอคุณยืนยันวันทำงาน (${h} ชม.)`,
        body: `งาน "${j.title}" — อีกฝ่ายเสนอวันมาแล้ว กรุณายืนยัน`,
        link: otherLink,
      }],
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanSubmitted(supabase: any, now: number, plans: PingPlan[]) {
  const threshold = new Date(now - 8 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("skc_jobs")
    .select("id, title, employer_id, approved_by_staff, staff_confirmed_completion, employer_confirmed_completion, updated_at")
    .eq("status", "SUBMITTED")
    .lt("updated_at", threshold);

  if (!data || data.length === 0) return;

  const { data: staff } = await supabase
    .from("skc_users")
    .select("id")
    .in("role", ["project_staff", "rmutl_staff", "admin", "superadmin"])
    .eq("approval_status", "APPROVED");
  const staffIds = (staff ?? []).map((s: { id: string }) => s.id);

  for (const j of data) {
    const h = hours(now - new Date(j.updated_at).getTime());

    // Need staff to confirm?
    if (!j.staff_confirmed_completion) {
      // Send to assigned supervisor + all staff (fallback)
      const supervisorIds = j.approved_by_staff ? [j.approved_by_staff] : staffIds;
      plans.push({
        jobId: j.id,
        jobTitle: j.title,
        kind: "submitted_staff",
        hoursStuck: h,
        adminText: `⏰ <b>นศ. ส่งงานแล้ว Staff ยังไม่ตรวจ ${h} ชม.</b>\n💼 ${esc(j.title)}`,
        adminLink: `/admin/jobs?id=${j.id}`,
        recipients: supervisorIds.map((id: string) => ({
          userId: id,
          title: `⏰ งานรอคุณตรวจ (${h} ชม.)`,
          body: `งาน "${j.title}" — นศ. ส่งงานแล้ว กดเปิดหน้าตรวจด้านล่าง`,
          link: `/project-staff/active-jobs`,
        })),
      });
    }

    // Need employer to confirm?
    if (!j.employer_confirmed_completion && j.employer_id) {
      plans.push({
        jobId: j.id,
        jobTitle: j.title,
        kind: "submitted_employer",
        hoursStuck: h,
        adminText: `⏰ <b>นศ. ส่งงานแล้ว ผู้จ้างยังไม่ตรวจ ${h} ชม.</b>\n💼 ${esc(j.title)}`,
        adminLink: `/admin/jobs?id=${j.id}`,
        recipients: [{
          userId: j.employer_id,
          title: `⏰ งานรอคุณยืนยัน (${h} ชม.)`,
          body: `นศ. ส่งงาน "${j.title}" แล้ว — กดเปิดหน้าตรวจด้านล่าง`,
          link: `/employer/jobs/${j.id}`,
        }],
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanUnpaidEscrow(supabase: any, now: number, plans: PingPlan[]) {
  const threshold = new Date(now - 12 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("skc_jobs")
    .select("id, title, pay_amount, approved_by_staff, updated_at")
    .eq("status", "COMPLETED")
    .eq("type", "PAID")
    .is("escrow_tx", null)
    .gt("pay_amount", 0)
    .lt("updated_at", threshold);

  if (!data || data.length === 0) return;

  const { data: staff } = await supabase
    .from("skc_users")
    .select("id")
    .in("role", ["project_staff", "rmutl_staff", "admin", "superadmin"])
    .eq("approval_status", "APPROVED");
  const staffIds = (staff ?? []).map((s: { id: string }) => s.id);

  for (const j of data) {
    const h = hours(now - new Date(j.updated_at).getTime());
    const supervisorIds = j.approved_by_staff ? [j.approved_by_staff] : staffIds;
    plans.push({
      jobId: j.id,
      jobTitle: j.title,
      kind: "unpaid_escrow",
      hoursStuck: h,
      adminText: `⏰ <b>งานเสร็จแล้วยังไม่จ่าย TRPB ${h} ชม.</b>\n💼 ${esc(j.title)}\n💰 ${Number(j.pay_amount).toLocaleString()} TRPB`,
      adminLink: `/admin/jobs?id=${j.id}`,
      recipients: supervisorIds.map((id: string) => ({
        userId: id,
        title: `⏰ งานเสร็จ รอคุณจ่าย TRPB (${h} ชม.)`,
        body: `งาน "${j.title}" รอจ่าย ${Number(j.pay_amount).toLocaleString()} TRPB — กดเปิดหน้าจ่ายด้านล่าง`,
        link: `/project-staff/trpb`,
      })),
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanUnsupervised(supabase: any, now: number, plans: PingPlan[]) {
  const threshold = new Date(now - 48 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("skc_jobs")
    .select("id, title, status, created_at")
    .in("status", ["OPEN", "ASSIGNED", "CONFIRMED", "IN_PROGRESS"])
    .is("approved_by_staff", null)
    .lt("created_at", threshold);

  if (!data || data.length === 0) return;

  const { data: staff } = await supabase
    .from("skc_users")
    .select("id")
    .in("role", ["project_staff", "rmutl_staff", "admin", "superadmin"])
    .eq("approval_status", "APPROVED");
  const staffIds = (staff ?? []).map((s: { id: string }) => s.id);

  for (const j of data) {
    const h = hours(now - new Date(j.created_at).getTime());
    plans.push({
      jobId: j.id,
      jobTitle: j.title,
      kind: "unsupervised",
      hoursStuck: h,
      adminText: `🆘 <b>งานไม่มีผู้กำกับ ${h} ชม.</b>\n💼 ${esc(j.title)}\n📊 สถานะ: ${j.status}`,
      adminLink: `/admin/jobs?id=${j.id}`,
      recipients: staffIds.map((id: string) => ({
        userId: id,
        title: `🆘 งานต้องรับเป็นผู้กำกับ (${h} ชม.)`,
        body: `งาน "${j.title}" ยังไม่มีผู้กำกับ — กดเปิดเพื่อรับ`,
        link: `/project-staff/active-jobs?filter=unsupervised`,
      })),
    });
  }
}

// Suppress unused import warning — notifyViaTelegram is exported for future use
void notifyViaTelegram;
void APP_URL;
