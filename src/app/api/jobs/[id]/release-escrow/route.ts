import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";
import { checkCanReleaseEscrow } from "@/lib/gov-sync";
import { escrowRelease, escrowHold, mint, getBalance, SYSTEM_POOL } from "@/lib/trpb-ledger";

// POST /api/jobs/[id]/release-escrow
// Off-chain TRPB ledger version. TRON Nile is no longer called automatically;
// admin can manually mirror via on_chain_ref later.
//
// Auto-fill behavior (pilot mode): if employer doesn't have enough held funds,
// the system tops them up from their balance (and from SYSTEM pool if needed)
// so testing works without manual mint+hold steps.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Role: only staff/admin
  const { data: profile } = await supabase
    .from("skc_users").select("role").eq("id", user.id).single();
  const allowedRoles = ["project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "เฉพาะคณะทำงาน/แอดมินเท่านั้น" }, { status: 403 });
  }

  const { data: job } = await supabase
    .from("skc_jobs")
    .select("status, escrow_tx, pay_amount, student_id, employer_id, type, title")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.status !== "COMPLETED")
    return NextResponse.json({ error: "งานยังไม่เสร็จสมบูรณ์" }, { status: 400 });
  if (job.escrow_tx)
    return NextResponse.json({ error: "จ่ายค่าจ้างไปแล้ว", tx_id: job.escrow_tx }, { status: 400 });
  if (job.type !== "PAID" || !job.pay_amount)
    return NextResponse.json({ error: "ไม่ใช่งานจ้าง" }, { status: 400 });
  if (!job.student_id)
    return NextResponse.json({ error: "งานนี้ยังไม่มี นศ. รับ" }, { status: 400 });
  if (!job.employer_id)
    return NextResponse.json({ error: "งานนี้ไม่มีผู้ว่าจ้าง" }, { status: 400 });

  // Gov gate (default: skip in pilot mode)
  const gate = await checkCanReleaseEscrow(supabase, jobId);
  if (!gate.allowed) {
    return NextResponse.json({
      error: gate.reason,
      suggestedAction: gate.suggestedAction,
      currentGovStatus: gate.currentGovStatus,
    }, { status: 403 });
  }

  const amount = Number(job.pay_amount);

  // ===== Auto-fill held funds for employer (pilot test mode) =====
  // Step 1: ensure employer has enough hold_balance for this payout
  const employerBal = await getBalance(supabase, job.employer_id);
  const employerHeld = employerBal?.hold_balance ?? 0;

  if (employerHeld < amount) {
    const needed = amount - employerHeld;
    const employerSpendable = employerBal?.balance ?? 0;

    // If employer's spendable also short, mint top-up from SYSTEM pool first
    if (employerSpendable < needed) {
      const topUp = needed - employerSpendable;
      const mintRes = await mint(supabase, job.employer_id, topUp, {
        jobId,
        reason: `Auto top-up เพื่อ release escrow งาน "${job.title}"`,
        createdBy: user.id,
      });
      if (!mintRes.ok) {
        return NextResponse.json({
          error: `Top-up ไม่สำเร็จ: ${mintRes.error}`,
          hint: "ลองให้ admin จ่าย TRPB ให้ผู้จ้างก่อนผ่าน /admin/trpb",
        }, { status: 500 });
      }
    }

    // Now hold the needed amount
    const holdRes = await escrowHold(supabase, job.employer_id, needed, jobId, user.id);
    if (!holdRes.ok) {
      return NextResponse.json({
        error: `กัน TRPB ไม่สำเร็จ: ${holdRes.error}`,
      }, { status: 500 });
    }
  }

  // Step 2: release held → student
  const releaseRes = await escrowRelease(
    supabase,
    job.employer_id,
    job.student_id,
    amount,
    jobId,
    user.id,
  );
  if (!releaseRes.ok) {
    return NextResponse.json({
      error: `ปล่อย escrow ไม่สำเร็จ: ${releaseRes.error}`,
    }, { status: 500 });
  }

  // Mark job as paid (use ledger tx id as escrow_tx ref)
  await supabase
    .from("skc_jobs")
    .update({ escrow_tx: `ledger:${releaseRes.txId}` })
    .eq("id", jobId);

  // Update employer quota counter
  const { data: emp } = await supabase
    .from("skc_users")
    .select("job_quota_used")
    .eq("id", job.employer_id)
    .single();
  if (emp) {
    await supabase
      .from("skc_users")
      .update({ job_quota_used: (emp.job_quota_used ?? 0) + 1 })
      .eq("id", job.employer_id);
  }

  await createNotification(supabase, {
    user_id: job.student_id,
    type: "payment_released",
    title: "ได้รับค่าจ้าง",
    body: `ค่าจ้าง ${amount.toLocaleString()} TRPB ถูกจ่ายเข้า wallet แล้ว`,
    link: "/wallet",
  });

  return NextResponse.json({
    message: `จ่ายค่าจ้าง ${amount.toLocaleString()} TRPB ให้ นศ. สำเร็จ`,
    tx_id: releaseRes.txId,
    ledger: true,
    note: "การจ่ายผ่าน off-chain ledger — TRON mirror สามารถ sync ภายหลังโดย admin",
  });
}
