import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveBatch, rejectBatch, reviewBatch } from "@/lib/gov-batch";
import { createNotification, notifyOwner, notifyUsersByTelegram } from "@/lib/telegram";

/**
 * GET   /api/gov/batches/[id]     — full detail + jobs in batch
 * PATCH /api/gov/batches/[id]     — approve | reject
 *   Body: { action: "approve" | "reject", note?: string, reason?: string }
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: batch, error } = await supabase
    .from("skc_gov_approval_batches")
    .select(`
      *,
      creator:skc_users!skc_gov_approval_batches_created_by_fkey(name),
      reviewer:skc_users!skc_gov_approval_batches_reviewed_by_fkey(name),
      approver:skc_users!skc_gov_approval_batches_approved_by_fkey(name)
    `)
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Jobs in this batch
  const { data: jobs } = await supabase
    .from("skc_jobs")
    .select(`
      id, title, type, job_category, pay_amount, deadline, required_workers,
      campus, location, status, gov_status,
      employer:skc_users!skc_jobs_employer_id_fkey(name, organization)
    `)
    .eq("gov_batch_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ batch, jobs });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "rmutl_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะคณะทำงาน/แอดมิน" }, { status: 403 });
  }

  const body = await req.json() as { action?: string; note?: string; reason?: string };
  const { action, note, reason } = body;

  try {
    if (action === "review") {
      // Mid-tier sign-off (รองอธิการบดี) — only allowed from COMPILED state
      const batch = await reviewBatch(supabase, id, user.id, note);

      // Notify owner + the creator
      notifyOwner(
        `📝 <b>รอบผ่านชั้นรองอธิการแล้ว</b>\n` +
        `<code>${batch.batch_no}</code> · รอลายเซ็นชั้นอธิการ\n` +
        (note ? `หมายเหตุ: ${note}` : ""),
        `/project-staff/gov-batches/${id}`,
      ).catch(() => {});

      if (batch.created_by) {
        await createNotification(supabase, {
          user_id: batch.created_by,
          type: "batch_reviewed",
          title: `รอบ ${batch.batch_no} ผ่านชั้นรองอธิการแล้ว`,
          body: "รออธิการบดีอนุมัติขั้นสุดท้าย",
          link: `/project-staff/gov-batches/${id}`,
        });
      }

      return NextResponse.json({ batch });
    }

    if (action === "approve") {
      const batch = await approveBatch(supabase, id, user.id, note);

      // Get list of employers + students to notify + also get team members from skc_job_workers
      const { data: jobs } = await supabase
        .from("skc_jobs")
        .select("id, title, employer_id, student_id")
        .eq("gov_batch_id", id);
      const { data: teamMembers } = await supabase
        .from("skc_job_workers")
        .select("student_id, job_id")
        .in("job_id", (jobs ?? []).map((j) => j.id));

      const userIds = new Set<string>();
      for (const j of jobs ?? []) {
        if (j.employer_id) userIds.add(j.employer_id);
        if (j.student_id) userIds.add(j.student_id);
      }
      for (const w of teamMembers ?? []) {
        if (w.student_id) userIds.add(w.student_id);
      }

      // In-app + Telegram (createNotification handles both)
      for (const uid of userIds) {
        await createNotification(supabase, {
          user_id: uid,
          type: "batch_approved",
          title: `งานของคุณได้รับอนุมัติแล้ว (${batch.batch_no})`,
          body: `รอบ ${batch.batch_no} ได้รับอนุมัติจากผู้บริหาร — งานของคุณสามารถดำเนินการต่อได้`,
          link: `/`,
        });
      }

      // Owner notification (admin chat)
      notifyOwner(
        `✅ <b>รอบอนุมัติแล้ว</b>\n` +
        `<code>${batch.batch_no}</code> · ${batch.total_jobs} งาน · ${Number(batch.total_amount).toLocaleString()} TRPB\n` +
        `ผู้แจ้งงานในรอบนี้ได้รับการแจ้งเตือนแล้ว (${userIds.size} คน)` +
        (note ? `\nหมายเหตุ: ${note}` : ""),
        `/project-staff/gov-batches/${id}`,
      ).catch(() => {});

      return NextResponse.json({ batch, notified: userIds.size });
    }

    if (action === "reject") {
      if (!reason) return NextResponse.json({ error: "กรอกเหตุผลที่ปฏิเสธ" }, { status: 400 });
      const batch = await rejectBatch(supabase, id, user.id, reason);

      // Owner notification
      notifyOwner(
        `❌ <b>รอบถูกปฏิเสธ</b>\n` +
        `<code>${batch.batch_no}</code> · ${batch.total_jobs} งาน — งานถูก rollback แล้ว\n` +
        `เหตุผล: ${reason}`,
        `/project-staff/gov-batches/${id}`,
      ).catch(() => {});

      // Notify staff who created the batch (so they can fix + recreate)
      if (batch.created_by) {
        await createNotification(supabase, {
          user_id: batch.created_by,
          type: "batch_rejected",
          title: `รอบ ${batch.batch_no} ถูกปฏิเสธ`,
          body: `เหตุผล: ${reason}\nงานในรอบถูกปลดกลับเป็น PROJECT_DRAFT — สร้างรอบใหม่ได้`,
          link: `/project-staff/gov-batches/${id}`,
        });
      }

      // Suppress unused-import warning (notifyUsersByTelegram available for future use)
      void notifyUsersByTelegram;

      return NextResponse.json({ batch });
    }

    return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
