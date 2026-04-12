import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";
import { TronWeb } from "tronweb";
import JobEscrowABI from "@/lib/tron/abi/JobEscrow.json";

// POST /api/jobs/[id]/release-escrow
// คณะทำงาน (project_staff/admin) กดปล่อยค่าจ้าง on-chain
// Server ใช้ deployer key เรียก escrow.release()
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ตรวจสอบ role: เฉพาะ staff/admin
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: "เฉพาะคณะทำงาน/แอดมินเท่านั้น" },
      { status: 403 }
    );
  }

  // ตรวจสอบ job status
  const { data: job } = await supabase
    .from("jobs")
    .select("status, escrow_tx, pay_amount, student_id, employer_id, type")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.status !== "COMPLETED")
    return NextResponse.json({ error: "งานยังไม่เสร็จสมบูรณ์" }, { status: 400 });
  if (job.escrow_tx)
    return NextResponse.json({ error: "จ่ายค่าจ้างไปแล้ว", tx_hash: job.escrow_tx }, { status: 400 });
  if (job.type !== "PAID" || !job.pay_amount)
    return NextResponse.json({ error: "ไม่ใช่งานจ้าง" }, { status: 400 });

  // ตรวจโควต้าผู้ว่าจ้าง (ถ้าตั้งไว้)
  if (job.employer_id) {
    const { data: employer } = await supabase
      .from("users")
      .select("job_quota, job_quota_used")
      .eq("id", job.employer_id)
      .single();

    if (employer && employer.job_quota > 0 && employer.job_quota_used >= employer.job_quota) {
      return NextResponse.json(
        { error: `ผู้ว่าจ้างใช้โควต้าครบแล้ว (${employer.job_quota_used}/${employer.job_quota})` },
        { status: 400 }
      );
    }
  }

  // ---- On-chain: release escrow ----
  const deployerKey = process.env.TRON_DEPLOYER_PRIVATE_KEY;
  const escrowAddress = process.env.NEXT_PUBLIC_JOB_ESCROW_ADDRESS;
  const tronHost = process.env.NEXT_PUBLIC_TRON_FULL_HOST || "https://nile.trongrid.io";

  if (!deployerKey || !escrowAddress) {
    return NextResponse.json(
      { error: "TRON config ยังไม่พร้อม (ตรวจ .env)" },
      { status: 500 }
    );
  }

  try {
    const tronWeb = new TronWeb({ fullHost: tronHost, privateKey: deployerKey });
    const escrow = tronWeb.contract(JobEscrowABI, escrowAddress);

    // UUID → bytes32
    const jobIdBytes32 = "0x" + jobId.replace(/-/g, "").padEnd(64, "0");

    // ตรวจ escrow on-chain
    const info = await escrow.getEscrow(jobIdBytes32).call();
    const escrowAmount = Number(info.amount) / 1e6;

    if (escrowAmount === 0) {
      // ยังไม่มี escrow → สร้างใหม่จาก deployer wallet (approve + create)
      const tokenAddress = process.env.NEXT_PUBLIC_TRPB_TOKEN_ADDRESS;
      if (!tokenAddress) {
        return NextResponse.json({ error: "TRPB Token address ไม่พร้อม" }, { status: 500 });
      }

      const TRPBTokenABI = (await import("@/lib/tron/abi/TRPBToken.json")).default;
      const token = tronWeb.contract(TRPBTokenABI, tokenAddress);
      const amountOnChain = Math.round(job.pay_amount * 1e6);

      // ดึง wallet address ของนักศึกษา
      let studentWallet: string | null = null;
      if (job.student_id) {
        const { data: studentProfile } = await supabase
          .from("users")
          .select("wallet_address")
          .eq("id", job.student_id)
          .single();
        studentWallet = studentProfile?.wallet_address ?? null;
      }
      // ถ้าไม่มี wallet → ใช้ deployer (fallback)
      const recipientAddr = studentWallet || tronWeb.address.fromPrivateKey(deployerKey);

      // Approve
      await token.approve(escrowAddress, amountOnChain).send({ feeLimit: 100_000_000 });
      await new Promise((r) => setTimeout(r, 4000));

      // Create escrow
      const zeroAddr = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
      await escrow
        .createEscrow(jobIdBytes32, recipientAddr, zeroAddr, amountOnChain)
        .send({ feeLimit: 100_000_000 });
      await new Promise((r) => setTimeout(r, 4000));
    }

    if (info.released) {
      // On-chain released แล้วแต่ DB ยังไม่มี tx → sync
      await supabase.from("jobs").update({ escrow_tx: "already-released-on-chain" }).eq("id", jobId);
      return NextResponse.json({
        message: "Escrow ถูก release ไปแล้ว on-chain — sync DB เรียบร้อย",
        tx_hash: "already-released-on-chain",
      });
    }

    // Release
    const releaseTx = await escrow.release(jobIdBytes32).send({ feeLimit: 100_000_000 });
    const txHash = typeof releaseTx === "string" ? releaseTx : releaseTx.txid || releaseTx;

    // บันทึก tx hash ใน DB
    await supabase.from("jobs").update({ escrow_tx: txHash }).eq("id", jobId);

    // อัปเดตโควต้าผู้ว่าจ้าง (+1)
    if (job.employer_id) {
      const { data: emp } = await supabase
        .from("users")
        .select("job_quota_used")
        .eq("id", job.employer_id)
        .single();
      if (emp) {
        await supabase
          .from("users")
          .update({ job_quota_used: (emp.job_quota_used ?? 0) + 1 })
          .eq("id", job.employer_id);
      }
    }

    // แจ้ง student
    if (job.student_id) {
      await createNotification(supabase, {
        user_id: job.student_id,
        type: "payment_released",
        title: "ได้รับค่าจ้าง",
        body: `ค่าจ้าง ${job.pay_amount.toLocaleString()} TRPB ถูกปล่อยแล้ว`,
        link: "/student/wallet",
      });
    }

    return NextResponse.json({
      message: `จ่ายค่าจ้าง ${job.pay_amount} TRPB สำเร็จ`,
      tx_hash: txHash,
      breakdown: {
        student: Math.round(job.pay_amount * 0.9), // 90% (no mentor)
        fund: Math.round(job.pay_amount * 0.05),
        staff: Math.round(job.pay_amount * 0.05),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("release-escrow error:", msg);
    return NextResponse.json({ error: `On-chain error: ${msg}` }, { status: 500 });
  }
}
