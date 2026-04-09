"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Wallet,
  CheckCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  isTronLinkInstalled,
  connectTronLink,
  approveEscrow,
  createEscrow,
  releaseEscrow,
  getEscrowInfo,
  calculateFeeBreakdown,
  formatTRPB,
  getTronScanUrl,
  CONTRACTS,
} from "@/lib/tron/client";
import { toast } from "sonner";

type Phase = "idle" | "connecting" | "checking" | "approving" | "creating" | "releasing" | "recording" | "done";

interface EscrowPaymentCardProps {
  jobId: string;
  jobStatus: string;
  payAmount: number;
  hasMentor: boolean;
  escrowTx: string | null;
  studentWallet: string | null;
  mentorWallet: string | null;
  onPaymentRecorded?: () => void;
}

export function EscrowPaymentCard({
  jobId,
  jobStatus,
  payAmount,
  hasMentor,
  escrowTx,
  studentWallet,
  mentorWallet,
  onPaymentRecorded,
}: EscrowPaymentCardProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<string | null>(escrowTx);
  const [error, setError] = useState<string | null>(null);

  const breakdown = calculateFeeBreakdown(payAmount, hasMentor);

  // ===== Step 1: สร้าง Escrow (เรียกตอน job ASSIGNED/IN_PROGRESS ถ้ายังไม่มี) =====
  async function handleCreateEscrow() {
    setError(null);
    try {
      if (!isTronLinkInstalled()) {
        setError("กรุณาติดตั้ง TronLink Extension");
        return;
      }
      setPhase("connecting");
      connectTronLink();

      if (!studentWallet) {
        setError("นักศึกษายังไม่ได้เชื่อมต่อ Wallet");
        setPhase("idle");
        return;
      }

      if (!CONTRACTS.JOB_ESCROW || !CONTRACTS.TRPB_TOKEN) {
        setError("Contract address ยังไม่ได้ตั้งค่า (ตรวจสอบ .env)");
        setPhase("idle");
        return;
      }

      // Approve TRPB for escrow contract
      setPhase("approving");
      toast.info("กำลังขออนุญาตหัก TRPB...");
      await approveEscrow(payAmount);

      // Create escrow
      setPhase("creating");
      toast.info("กำลังสร้าง Escrow บน Blockchain...");
      const tx = await createEscrow(jobId, studentWallet, mentorWallet, payAmount);
      toast.success(`สร้าง Escrow สำเร็จ — TX: ${tx.slice(0, 12)}...`);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setPhase("idle");
    }
  }

  // ===== Step 2: Release Escrow (เรียกตอน job COMPLETED) =====
  async function handleRelease() {
    setError(null);
    try {
      if (!isTronLinkInstalled()) {
        setError("กรุณาติดตั้ง TronLink Extension");
        return;
      }
      setPhase("connecting");
      connectTronLink();

      if (!CONTRACTS.JOB_ESCROW) {
        setError("Contract address ยังไม่ได้ตั้งค่า (ตรวจสอบ .env)");
        setPhase("idle");
        return;
      }

      // Check escrow exists
      setPhase("checking");
      let escrowInfo;
      try {
        escrowInfo = await getEscrowInfo(jobId);
      } catch {
        setError("ไม่พบ Escrow สำหรับงานนี้ — อาจยังไม่ได้ฝากเงิน");
        setPhase("idle");
        return;
      }

      if (escrowInfo.released) {
        setError("Escrow ถูก release แล้ว");
        setPhase("idle");
        return;
      }

      // Release
      setPhase("releasing");
      toast.info("กำลังปล่อยค่าจ้างบน Blockchain...");
      const tx = await releaseEscrow(jobId);

      // Record tx in DB
      setPhase("recording");
      const res = await fetch(`/api/jobs/${jobId}/record-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_hash: tx }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.warning(data.error || "บันทึก tx ใน DB ไม่สำเร็จ แต่ on-chain สำเร็จแล้ว");
      }

      setTxHash(tx);
      setPhase("done");
      toast.success("จ่ายค่าจ้างสำเร็จ!");
      onPaymentRecorded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setPhase("idle");
    }
  }

  // Already paid
  if (txHash) {
    return (
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600" />
            จ่ายค่าจ้างแล้ว
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FeeBreakdown breakdown={breakdown} />
          <a
            href={getTronScanUrl(txHash, "transaction")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="size-3" />
            ดู Transaction บน TronScan
          </a>
        </CardContent>
      </Card>
    );
  }

  // Job not completed yet — show escrow creation
  if (jobStatus !== "COMPLETED") {
    return (
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <Wallet className="size-5 text-blue-600" />
            Escrow — ฝากค่าจ้าง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FeeBreakdown breakdown={breakdown} />
          <p className="text-xs text-muted-foreground">
            ฝากเงินค่าจ้างเข้า Smart Contract เพื่อความโปร่งใส — เงินจะถูกปล่อยเมื่องานเสร็จ
          </p>
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="size-3" />
              {error}
            </p>
          )}
          <Button
            onClick={handleCreateEscrow}
            disabled={phase !== "idle"}
            className="w-full"
          >
            {phase !== "idle" ? (
              <><Loader2 className="size-4 mr-2 animate-spin" />
              {phase === "connecting" && "กำลังเชื่อมต่อ TronLink..."}
              {phase === "approving" && "กำลัง Approve TRPB..."}
              {phase === "creating" && "กำลังสร้าง Escrow..."}
              </>
            ) : (
              <><Wallet className="size-4 mr-2" />ฝากค่าจ้าง {formatTRPB(payAmount)}</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // COMPLETED — release payment
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="text-foreground text-sm flex items-center gap-2">
          <Wallet className="size-5 text-amber-600" />
          จ่ายค่าจ้าง — Release Escrow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FeeBreakdown breakdown={breakdown} />
        <p className="text-xs text-muted-foreground">
          ปล่อยค่าจ้างจาก Escrow → แบ่งอัตโนมัติตามสัดส่วน 85/5/5/5
        </p>
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            {error}
          </p>
        )}
        <Button
          onClick={handleRelease}
          disabled={phase !== "idle"}
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          {phase !== "idle" ? (
            <><Loader2 className="size-4 mr-2 animate-spin" />
            {phase === "connecting" && "กำลังเชื่อมต่อ TronLink..."}
            {phase === "checking" && "ตรวจสอบ Escrow..."}
            {phase === "releasing" && "กำลังปล่อยค่าจ้าง..."}
            {phase === "recording" && "บันทึก Transaction..."}
            </>
          ) : (
            <><Wallet className="size-4 mr-2" />จ่ายค่าจ้าง {formatTRPB(payAmount)}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function FeeBreakdown({ breakdown }: { breakdown: ReturnType<typeof calculateFeeBreakdown> }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex justify-between bg-green-50 rounded p-2">
        <span className="text-muted-foreground">นักศึกษา</span>
        <span className="font-medium text-green-700">{formatTRPB(breakdown.student)}</span>
      </div>
      <div className="flex justify-between bg-blue-50 rounded p-2">
        <span className="text-muted-foreground">กองทุนกลาง</span>
        <span className="font-medium text-blue-700">{formatTRPB(breakdown.fund)}</span>
      </div>
      {breakdown.mentor > 0 && (
        <div className="flex justify-between bg-purple-50 rounded p-2">
          <span className="text-muted-foreground">Mentor</span>
          <span className="font-medium text-purple-700">{formatTRPB(breakdown.mentor)}</span>
        </div>
      )}
      <div className="flex justify-between bg-orange-50 rounded p-2">
        <span className="text-muted-foreground">คณะทำงาน</span>
        <span className="font-medium text-orange-700">{formatTRPB(breakdown.staff)}</span>
      </div>
    </div>
  );
}
