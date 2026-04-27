import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logWorkflowTransition, notifyNextAction, canTransition } from "@/lib/gov-workflow";

// POST /api/gov/activity-approvals/[id]/approve — อนุมัติหรือปฏิเสธกิจกรรม
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff", "teacher"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะผู้มีอำนาจอนุมัติ (คณบดี/admin/อาจารย์)" }, { status: 403 });
  }

  const body = await request.json();
  const { decision, approval_ref, rejection_reason } = body;

  if (!["APPROVE", "REJECT"].includes(decision)) {
    return NextResponse.json({ error: "decision ต้องเป็น APPROVE หรือ REJECT" }, { status: 400 });
  }

  // Get current activity
  const { data: activity, error: fetchErr } = await supabase
    .from("skc_activity_approvals")
    .select("*, job:skc_jobs(id, title, gov_status)")
    .eq("id", id)
    .single();

  if (fetchErr || !activity) {
    return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
  }

  if (activity.status === "APPROVED" || activity.status === "REJECTED") {
    return NextResponse.json({ error: "กิจกรรมนี้ถูกดำเนินการไปแล้ว" }, { status: 400 });
  }

  const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const newGovStatus = decision === "APPROVE" ? "ACTIVITY_APPROVED" : "REJECTED";

  // Validate transition
  if (!canTransition(activity.job?.gov_status || "ACTIVITY_APPROVAL_PENDING", newGovStatus)) {
    return NextResponse.json({
      error: `ไม่สามารถเปลี่ยนสถานะจาก ${activity.job?.gov_status} เป็น ${newGovStatus} ได้`
    }, { status: 400 });
  }

  // Update activity
  const { error: updateErr } = await supabase
    .from("skc_activity_approvals")
    .update({
      status: newStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_ref: approval_ref,
      rejection_reason: rejection_reason,
    })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Update job gov_status
  if (activity.job_id) {
    await supabase.from("skc_jobs").update({ gov_status: newGovStatus }).eq("id", activity.job_id);
  }

  // Log + Notify
  await logWorkflowTransition(supabase, {
    jobId: activity.job_id,
    activityId: id,
    fromStatus: "ACTIVITY_APPROVAL_PENDING",
    toStatus: newGovStatus,
    actorId: user.id,
    note: decision === "APPROVE" ? `อนุมัติกิจกรรม (ref: ${approval_ref})` : `ปฏิเสธ: ${rejection_reason}`,
  });

  await notifyNextAction({
    supabase,
    toStatus: newGovStatus,
    jobId: activity.job_id,
    activityId: id,
    jobTitle: activity.job?.title,
  });

  return NextResponse.json({ success: true, decision });
}
