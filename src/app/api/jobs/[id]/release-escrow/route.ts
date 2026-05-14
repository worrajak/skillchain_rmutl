import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification, notifyAdmin } from "@/lib/telegram";
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
    .select("status, escrow_tx, pay_amount, student_id, employer_id, type, title, approved_by_staff, mentor_id, engagement_mode, pay_per_person")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.status !== "COMPLETED")
    return NextResponse.json({ error: "งานยังไม่เสร็จสมบูรณ์" }, { status: 400 });
  if (job.escrow_tx)
    return NextResponse.json({ error: "จ่ายค่าจ้างไปแล้ว", tx_id: job.escrow_tx }, { status: 400 });
  if (job.type !== "PAID" || !job.pay_amount)
    return NextResponse.json({ error: "ไม่ใช่งานจ้าง" }, { status: 400 });
  // For ACTIVITY mode: job.student_id is NULL (workers live in skc_job_workers)
  if (!job.student_id && job.engagement_mode !== "ACTIVITY")
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

  // Step 2: 3-way split (90% students / 5% fund / 5% staff supervisor)
  // Plus engagement-mode-specific worker handling:
  //   - SOLO/TEAM: equal split among ALL workers in skc_job_workers
  //   - ACTIVITY: per-person rate × number of ATTENDED participants only
  //                NO_SHOW are skipped entirely (no payment).
  const hasMentor = !!job.mentor_id;
  const STUDENT_BPS = hasMentor ? 8500 : 9000;
  const FUND_BPS = 500;
  const MENTOR_BPS = hasMentor ? 500 : 0;
  const isActivity = job.engagement_mode === "ACTIVITY";

  // Resolve workers depending on engagement_mode
  const workerQuery = supabase
    .from("skc_job_workers")
    .select("student_id, role, attendance_status")
    .eq("job_id", jobId);
  if (isActivity) {
    // Activity: only ATTENDED count for payment
    workerQuery.eq("attendance_status", "ATTENDED");
  } else {
    workerQuery.order("role", { ascending: false }); // LEAD first
  }
  const { data: workers } = await workerQuery;

  const teamIds = (workers ?? []).map((w) => w.student_id);
  if (!isActivity && teamIds.length === 0 && job.student_id) teamIds.push(job.student_id);

  if (teamIds.length === 0) {
    return NextResponse.json({
      error: isActivity
        ? "ยังไม่มีผู้เข้าร่วมที่ ATTENDED — ให้ staff confirm attendance ก่อน"
        : "ไม่มีนักศึกษาในทีม",
    }, { status: 400 });
  }

  // Compute amount per engagement mode
  let amountToCharge: number;
  let studentShares: { studentId: string; amount: number }[];
  let totalStudentAmount: number;

  if (isActivity) {
    // ACTIVITY: pay_per_person is already GROSS (set at job creation: ceil(net/0.9))
    // Total cost = gross_per_person × attended_count
    const grossPerPerson = Number(job.pay_per_person ?? 0);
    if (grossPerPerson <= 0) {
      return NextResponse.json({ error: "งานนี้ไม่ได้กำหนดค่าตอบแทนต่อคน" }, { status: 400 });
    }
    amountToCharge = grossPerPerson * teamIds.length;
    // Net per student = gross × 90% (rounded down)
    const netPerStudent = Math.floor((grossPerPerson * STUDENT_BPS) / 10000);
    totalStudentAmount = netPerStudent * teamIds.length;
    studentShares = teamIds.map((id) => ({ studentId: id, amount: netPerStudent }));
  } else {
    // SOLO/TEAM: split the existing pay_amount
    amountToCharge = amount;
    totalStudentAmount = Math.floor((amount * STUDENT_BPS) / 10000);
    const perStudent = Math.floor(totalStudentAmount / teamIds.length);
    studentShares = teamIds.map((id, i) => ({
      studentId: id,
      amount: i === 0 ? totalStudentAmount - perStudent * (teamIds.length - 1) : perStudent,
    }));
  }

  const fundAmount = Math.floor((amountToCharge * FUND_BPS) / 10000);
  const mentorAmount = Math.floor((amountToCharge * MENTOR_BPS) / 10000);
  const staffAmount = amountToCharge - totalStudentAmount - fundAmount - mentorAmount;

  // ===== Auto-fill held funds for employer (pilot test mode) =====
  // Now we know amountToCharge — ensure employer hold_balance ≥ amountToCharge
  const employerBal = await getBalance(supabase, job.employer_id);
  const employerHeld = employerBal?.hold_balance ?? 0;

  if (employerHeld < amountToCharge) {
    const needed = amountToCharge - employerHeld;
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

    const holdRes = await escrowHold(supabase, job.employer_id, needed, jobId, user.id);
    if (!holdRes.ok) {
      return NextResponse.json({
        error: `กัน TRPB ไม่สำเร็จ: ${holdRes.error}`,
      }, { status: 500 });
    }
  }

  // 2a) Release to each team member
  let releaseRes: Awaited<ReturnType<typeof escrowRelease>> | null = null;
  for (const { studentId, amount: share } of studentShares) {
    if (share <= 0) continue;
    const r = await escrowRelease(supabase, job.employer_id, studentId, share, jobId, user.id);
    if (!r.ok) {
      return NextResponse.json({ error: `ปล่อย escrow ให้ ${studentId} ไม่สำเร็จ: ${r.error}` }, { status: 500 });
    }
    if (!releaseRes) releaseRes = r; // remember first for tx_id reporting
  }
  if (!releaseRes) {
    return NextResponse.json({ error: "ไม่มีรายการ release ที่สำเร็จ" }, { status: 500 });
  }

  // 2b) → SYSTEM (fund pool)
  if (fundAmount > 0) {
    await escrowRelease(supabase, job.employer_id, SYSTEM_POOL, fundAmount, jobId, user.id);
  }

  // 2c) → staff supervisor (or recycle to LEAD if no staff)
  if (staffAmount > 0 && job.approved_by_staff) {
    await escrowRelease(supabase, job.employer_id, job.approved_by_staff, staffAmount, jobId, user.id);
  } else if (staffAmount > 0) {
    await escrowRelease(supabase, job.employer_id, teamIds[0], staffAmount, jobId, user.id);
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

  // Resolve wallet addresses for all recipients (team + staff + mentor)
  const recipientIds = [...teamIds, job.approved_by_staff, job.mentor_id].filter(Boolean) as string[];
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

  // Mirror to each team member their equal share
  for (let i = 0; i < studentShares.length; i++) {
    const { studentId, amount: share } = studentShares[i];
    const role = i === 0 ? "student-lead" : "student-team";
    // If no staff supervisor, the recycle goes to LEAD only (already credited in 2c)
    const totalForLead = !job.approved_by_staff && i === 0 ? share + staffAmount : share;
    await mirror(studentId, totalForLead, role);
  }
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

  // For ACTIVITY: mark all paid participants with the amount + status PAID
  if (isActivity) {
    for (const { studentId, amount: share } of studentShares) {
      await supabase
        .from("skc_job_workers")
        .update({ attendance_status: "PAID", paid_amount: share })
        .eq("job_id", jobId)
        .eq("student_id", studentId);
    }
  }

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

  // Notify every team member
  for (const { studentId, amount: share } of studentShares) {
    await createNotification(supabase, {
      user_id: studentId,
      type: "payment_released",
      title: "ได้รับค่าจ้าง",
      body: teamIds.length > 1
        ? `ค่าจ้าง ${share.toLocaleString()} TRPB (ส่วนแบ่งทีม ${teamIds.length} คน) ถูกจ่ายเข้า wallet แล้ว`
        : `ค่าจ้าง ${share.toLocaleString()} TRPB ถูกจ่ายเข้า wallet แล้ว`,
      link: "/wallet",
    });
  }

  notifyAdmin(supabase, {
    actorId: user.id,
    action: `ปล่อย TRPB ให้ทีม (${teamIds.length} คน)`,
    targetType: "job",
    targetId: jobId,
    targetTitle: job.title,
    link: `/admin/jobs?id=${jobId}`,
    severity: "alert",
    extra: `${amountToCharge.toLocaleString()} TRPB · ${onChainTxId ? `on-chain TX: ${String(onChainTxId).slice(0, 12)}…` : "off-chain ledger only"}`,
  }).catch(() => {});

  return NextResponse.json({
    message: onChainTxId
      ? `จ่ายค่าจ้าง ${amountToCharge.toLocaleString()} TRPB สำเร็จ (${teamIds.length} คน · on-chain mirror ผ่าน TRON Nile)`
      : `จ่ายค่าจ้าง ${amountToCharge.toLocaleString()} TRPB ให้ ${teamIds.length} คน สำเร็จ`,
    tx_id: releaseRes.txId,
    on_chain_tx: onChainTxId,
    on_chain_error: onChainError,
    on_chain_breakdown: onChainTxs,
    team_size: teamIds.length,
    split: {
      student_total: totalStudentAmount,
      per_student: studentShares[0]?.amount ?? 0,
      fund: fundAmount,
      mentor: mentorAmount,
      staff: staffAmount,
      total: amountToCharge,
    },
    ledger: true,
    note: onChainTxId
      ? `On-chain TX: https://nile.tronscan.org/#/transaction/${onChainTxId}`
      : "On-chain mirror ไม่สำเร็จ หรือยังไม่มี wallet ผูก — Off-chain ledger สำเร็จ",
  });
}
