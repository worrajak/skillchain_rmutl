import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logWorkflowTransition, notifyNextAction } from "@/lib/gov-workflow";
import { onDisbursementApproved } from "@/lib/gov-sync";
import { notifyAdmin } from "@/lib/telegram";

// POST /api/gov/disbursements/[id]/approve
// อนุมัติใบเบิกแต่ละขั้น: HEAD, FINANCE, FINAL
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "rmutl_staff"].includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะผู้มีอำนาจอนุมัติ" }, { status: 403 });
  }

  const body = await request.json();
  const { stage, decision, rejection_reason } = body;

  if (!["HEAD", "FINANCE", "FINAL"].includes(stage)) {
    return NextResponse.json({ error: "stage ต้องเป็น HEAD, FINANCE หรือ FINAL" }, { status: 400 });
  }
  if (!["APPROVE", "REJECT"].includes(decision)) {
    return NextResponse.json({ error: "decision ต้องเป็น APPROVE หรือ REJECT" }, { status: 400 });
  }

  const { data: disb } = await supabase.from("skc_disbursements").select("*").eq("id", id).single();
  if (!disb) return NextResponse.json({ error: "ไม่พบใบเบิก" }, { status: 404 });

  const updates: any = {};
  const now = new Date().toISOString();

  if (decision === "REJECT") {
    updates.status = "REJECTED";
    updates.rejection_reason = rejection_reason;
  } else {
    // APPROVE - stage-specific
    if (stage === "HEAD") {
      updates.head_approved_by = user.id;
      updates.head_approved_at = now;
    } else if (stage === "FINANCE") {
      if (!disb.head_approved_at) {
        return NextResponse.json({ error: "ต้องผ่านการอนุมัติจากหัวหน้าโครงการก่อน" }, { status: 400 });
      }
      updates.finance_approved_by = user.id;
      updates.finance_approved_at = now;
    } else if (stage === "FINAL") {
      if (!disb.finance_approved_at) {
        return NextResponse.json({ error: "ต้องผ่านการตรวจสอบจากฝ่ายการเงินก่อน" }, { status: 400 });
      }
      updates.final_approved_by = user.id;
      updates.final_approved_at = now;
      updates.status = "APPROVED";
    }
  }

  const { error: updateErr } = await supabase.from("skc_disbursements").update(updates).eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // ถ้า FINAL approved → update jobs gov_status
  if (stage === "FINAL" && decision === "APPROVE") {
    const jobIds = [...new Set(((disb.items as any[]) || []).map(i => i.job_id).filter(Boolean))];
    for (const jobId of jobIds) {
      await supabase.from("skc_jobs").update({ gov_status: "DISBURSEMENT_APPROVED" }).eq("id", jobId);
      await logWorkflowTransition(supabase, {
        jobId,
        toStatus: "DISBURSEMENT_APPROVED",
        actorId: user.id,
        note: `ใบเบิกอนุมัติขั้นสุดท้าย (${disb.disbursement_ref})`,
      });
    }
    await notifyNextAction({
      supabase,
      toStatus: "DISBURSEMENT_APPROVED",
      docRef: disb.disbursement_ref,
    });

    // ===== GOV SYNC HOOK =====
    // ปลดล็อค escrow + แจ้ง นศ. ว่าเงินใกล้มาแล้ว
    await onDisbursementApproved(supabase, id);
  } else if (decision === "REJECT") {
    await notifyNextAction({
      supabase,
      toStatus: "REJECTED",
      docRef: disb.disbursement_ref,
    });
  }

  notifyAdmin(supabase, {
    actorId: user.id,
    action: `อนุมัติใบเบิก: ${stage} → ${decision}`,
    targetType: "batch",
    targetId: id,
    targetTitle: disb.disbursement_ref,
    link: `/admin/dashboard`,
    severity: decision === "REJECT" ? "warn" : (stage === "FINAL" ? "alert" : "info"),
    extra: decision === "REJECT" ? rejection_reason?.slice(0, 80) : undefined,
  }).catch(() => {});

  return NextResponse.json({ success: true, stage, decision });
}
