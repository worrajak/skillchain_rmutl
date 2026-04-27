import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logWorkflowTransition, notifyNextAction } from "@/lib/gov-workflow";
import { onDisbursementPaid } from "@/lib/gov-sync";

// POST /api/gov/disbursements/[id]/pay — บันทึกการจ่ายเงินจริง
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะ staff/admin" }, { status: 403 });
  }

  const body = await request.json();
  const { payment_method, payment_ref } = body;

  const { data: disb } = await supabase.from("skc_disbursements").select("*").eq("id", id).single();
  if (!disb) return NextResponse.json({ error: "ไม่พบใบเบิก" }, { status: 404 });
  if (disb.status !== "APPROVED") {
    return NextResponse.json({ error: "ใบเบิกยังไม่ได้รับอนุมัติ" }, { status: 400 });
  }

  await supabase.from("skc_disbursements").update({
    paid_at: new Date().toISOString(),
    payment_method: payment_method || "transfer",
    payment_ref,
    status: "ARCHIVED",
  }).eq("id", id);

  const jobIds = [...new Set(((disb.items as any[]) || []).map(i => i.job_id).filter(Boolean))];
  for (const jobId of jobIds) {
    await supabase.from("skc_jobs").update({ gov_status: "PAID" }).eq("id", jobId);
    await logWorkflowTransition(supabase, {
      jobId,
      fromStatus: "DISBURSEMENT_APPROVED",
      toStatus: "PAID",
      actorId: user.id,
      note: `จ่ายเงินผ่าน ${payment_method} (ref: ${payment_ref})`,
    });
  }

  await notifyNextAction({
    supabase,
    toStatus: "PAID",
    docRef: disb.disbursement_ref,
  });

  // ===== GOV SYNC HOOK =====
  // แจ้ง นศ. ว่าได้รับเงินแล้ว + update gov_status
  await onDisbursementPaid(supabase, id);

  return NextResponse.json({ success: true });
}
