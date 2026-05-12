import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveBatch, rejectBatch } from "@/lib/gov-batch";
import { createNotification } from "@/lib/telegram";

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
    if (action === "approve") {
      const batch = await approveBatch(supabase, id, user.id, note);

      // Get list of employers + students to notify
      const { data: jobs } = await supabase
        .from("skc_jobs")
        .select("id, title, employer_id, student_id")
        .eq("gov_batch_id", id);
      const userIds = new Set<string>();
      for (const j of jobs ?? []) {
        if (j.employer_id) userIds.add(j.employer_id);
        if (j.student_id) userIds.add(j.student_id);
      }
      // Bulk notify
      for (const uid of userIds) {
        await createNotification(supabase, {
          user_id: uid,
          type: "batch_approved",
          title: `งานของคุณได้รับอนุมัติแล้ว (${batch.batch_no})`,
          body: `รอบ ${batch.batch_no} ได้รับอนุมัติจากผู้บริหาร — งานของคุณสามารถดำเนินการต่อได้`,
          link: `/`,
        });
      }
      return NextResponse.json({ batch });
    }

    if (action === "reject") {
      if (!reason) return NextResponse.json({ error: "กรอกเหตุผลที่ปฏิเสธ" }, { status: 400 });
      const batch = await rejectBatch(supabase, id, user.id, reason);
      return NextResponse.json({ batch });
    }

    return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
