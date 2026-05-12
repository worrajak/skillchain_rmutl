import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";
import { checkCanReleaseEscrow } from "@/lib/gov-sync";
import { escrowRelease, escrowHold, mint, getBalance, SYSTEM_POOL } from "@/lib/trpb-ledger";
import { transferTRPBOnChain } from "@/lib/tron/server";

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
    .select("status, escrow_tx, pay_amount, student_id, employer_id, type, title, approved_by_staff, mentor_id")
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

  // Step 2: 3-way split release (90% นศ. / 5% กองทุน / 5% staff supervisor)
  // Note: ถ้าไม่มี staff supervisor หรือ mentor → recyclable share กลับเข้า student
  const hasMentor = !!job.mentor_id;
  const STUDENT_BPS = hasMentor ? 8500 : 9000;
  const FUND_BPS = 500;
  const MENTOR_BPS = hasMentor ? 500 : 0;
  // staff = remainder

  const studentAmount = Math.floor((amount * STUDENT_BPS) / 10000);
  const fundAmount = Math.floor((amount * FUND_BPS) / 10000);
  const mentorAmount = Math.floor((amount * MENTOR_BPS) / 10000);
  const staffAmount = amount - studentAmount - fundAmount - mentorAmount; // residual

  // 2a) → student
  const releaseRes = await escrowRelease(
    supabase, job.employer_id, job.student_id, studentAmount, jobId, user.id,
  );
  if (!releaseRes.ok) {
    return NextResponse.json({ error: `ปล่อย escrow ไม่สำเร็จ: ${releaseRes.error}` }, { status: 500 });
  }

  // 2b) → SYSTEM (fund pool) — silent log only
  if (fundAmount > 0) {
    await escrowRelease(supabase, job.employer_id, SYSTEM_POOL, fundAmount, jobId, user.id);
  }

  // 2c) → staff supervisor
  if (staffAmount > 0 && job.approved_by_staff) {
    await escrowRelease(supabase, job.employer_id, job.approved_by_staff, staffAmount, jobId, user.id);
  } else if (staffAmount > 0) {
    // No staff supervisor — recycle to student
    await escrowRelease(supabase, job.employer_id, job.student_id, staffAmount, jobId, user.id);
  }

  // 2d) → mentor (if any)
  if (mentorAmount > 0 && job.mentor_id) {
    await escrowRelease(supabase, job.employer_id, job.mentor_id, mentorAmount, jobId, user.id);
  }

  // ===== Step 3 (optional): Mirror payment on TRON Nile testnet =====
  // For each recipient with a bound TRON wallet, fire a TRC-20 transfer from
  // the deployer treasury. The off-chain ledger remains the source of truth.
  let onChainTxId: string | null = null;
  let onChainError: string | null = null;
  let escrowTxRef = `ledger:${releaseRes.txId}`;
  const onChainTxs: { recipient: string; amount: number; txId: string; role: string }[] = [];

  // Resolve wallet addresses for recipients
  const recipientIds = [job.student_id, job.approved_by_staff, job.mentor_id].filter(Boolean) as string[];
  const { data: walletRows } = await supabase
    .from("skc_users")
    .select("id, wallet_address")
    .in("id", recipientIds);
  const walletMap = Object.fromEntries((walletRows ?? []).map((u: { id: string; wallet_address: string | null }) => [u.id, u.wallet_address]));

  // Helper: try on-chain transfer for a single recipient
  async function mirror(userId: string | null | undefined, mirrorAmount: number, role: string) {
    if (!userId || mirrorAmount <= 0) return;
    const addr = walletMap[userId];
    if (!addr) return;
    const r = await transferTRPBOnChain(addr, mirrorAmount);
    if (r.ok) {
      onChainTxs.push({ recipient: addr, amount: mirrorAmount, txId: r.txId, role });
      if (!onChainTxId) onChainTxId = r.txId; // first success → primary tx
    } else {
      onChainError = onChainError ?? r.error;
      console.warn(`[release-escrow] On-chain mirror failed for ${role} (${addr}):`, r.error);
    }
  }

  await mirror(job.student_id, studentAmount + (job.approved_by_staff ? 0 : staffAmount), "student");
  await mirror(job.approved_by_staff, staffAmount, "staff");
  await mirror(job.mentor_id, mentorAmount, "mentor");
  // Note: SYSTEM/fund pool ไม่มี wallet_address บน-chain (off-chain only)

  if (onChainTxId) {
    escrowTxRef = onChainTxId; // Use first tx hash for TronScan deep-link
    await supabase
      .from("skc_trpb_transactions")
      .update({ on_chain_ref: onChainTxId })
      .eq("id", releaseRes.txId);
  }

  // Mark job as paid (escrow_tx = on-chain hash if available, else ledger:<id>)
  await supabase
    .from("skc_jobs")
    .update({ escrow_tx: escrowTxRef })
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
    message: onChainTxId
      ? `จ่ายค่าจ้าง ${amount.toLocaleString()} TRPB สำเร็จ (on-chain mirror ผ่าน TRON Nile)`
      : `จ่ายค่าจ้าง ${amount.toLocaleString()} TRPB ให้ นศ. สำเร็จ`,
    tx_id: releaseRes.txId,
    on_chain_tx: onChainTxId,
    on_chain_error: onChainError,
    on_chain_breakdown: onChainTxs,
    split: {
      student: studentAmount,
      fund: fundAmount,
      mentor: mentorAmount,
      staff: staffAmount,
      total: amount,
    },
    ledger: true,
    note: onChainTxId
      ? `On-chain TX: https://nile.tronscan.org/#/transaction/${onChainTxId}`
      : "On-chain mirror ไม่สำเร็จ หรือยังไม่มี wallet ผูก — Off-chain ledger สำเร็จ",
  });
}
