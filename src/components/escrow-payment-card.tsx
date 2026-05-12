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
import { calculateFeeBreakdown, formatTRPB } from "@/lib/tron/client";
import { toast } from "sonner";

interface EscrowPaymentCardProps {
  jobId: string;
  jobStatus: string;
  payAmount: number;
  hasMentor: boolean;
  escrowTx: string | null;
  /** Who is viewing — controls whether the release button shows.
   * 'staff' (default) = can release. 'employer' = waiting card only. */
  viewerRole?: "staff" | "employer";
  // Kept for back-compat with employer detail page; off-chain ledger doesn't
  // require these but the prop still exists at the call site.
  studentWallet?: string | null;
  mentorWallet?: string | null;
  onPaymentRecorded?: () => void;
}

/**
 * Off-chain Escrow Payment.
 *
 * The previous version required TronLink + manual approve+create+release on
 * Nile testnet. We now drive everything through the off-chain ledger:
 *   - Employer's TRPB balance is auto-debited via fn_trpb_escrow_release
 *   - The release-escrow API tops up from SYSTEM pool if needed (test mode)
 *   - Payment record stores 'ledger:<tx_id>' so we can mirror to TRON later
 */
export function EscrowPaymentCard({
  jobId,
  jobStatus,
  payAmount,
  hasMentor,
  escrowTx,
  viewerRole = "staff",
  onPaymentRecorded,
}: EscrowPaymentCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(!!escrowTx);
  const [paidTx, setPaidTx] = useState<string | null>(escrowTx);

  const breakdown = calculateFeeBreakdown(payAmount, hasMentor);

  async function handleRelease() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/release-escrow`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "จ่ายค่าจ้างไม่สำเร็จ");
        toast.error(data.error || "จ่ายค่าจ้างไม่สำเร็จ", { duration: 8000 });
        return;
      }
      toast.success(data.message);
      setPaid(true);
      setPaidTx(data.tx_id ? `ledger:${data.tx_id}` : "ledger:done");
      onPaymentRecorded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  // Already paid — show summary + audit link
  if (paid) {
    const isLedger = paidTx?.startsWith("ledger:");
    const hash = paidTx?.replace(/^ledger:/, "");
    return (
      <Card className="border-green-200 bg-green-50/40">
        <CardHeader>
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <CheckCircle className="size-5 text-green-600" />
            จ่ายค่าจ้างแล้ว
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FeeBreakdown breakdown={breakdown} />
          {isLedger ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>📒 Ledger TX:</span>
              <code className="font-mono">{hash?.slice(0, 12)}...</code>
            </div>
          ) : paidTx ? (
            <a
              href={`https://nile.tronscan.org/#/transaction/${paidTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="size-3" />
              ดู Transaction บน TronScan
            </a>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // Job not completed yet — escrow auto-handled when staff releases
  if (jobStatus !== "COMPLETED") {
    return (
      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader>
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <Wallet className="size-5 text-blue-600" />
            Escrow — ค่าจ้าง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <FeeBreakdown breakdown={breakdown} />
          <p className="text-xs">
            ค่าจ้างจะถูกหักจากยอด TRPB ของคุณเมื่อ <strong>คณะทำงานยืนยันงานเสร็จ</strong> และ <strong>กดปล่อย Escrow</strong>
          </p>
          <p className="text-xs">
            (ไม่ต้องเชื่อมต่อ TronLink — ระบบใช้ off-chain ledger แล้ว)
          </p>
        </CardContent>
      </Card>
    );
  }

  // COMPLETED + employer is viewing — show waiting card (no button)
  // Employer doesn't release; staff supervisor does. This avoids the
  // confusing 403 from the API and matches the agreed flow.
  if (viewerRole === "employer") {
    return (
      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader>
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <Loader2 className="size-5 text-yellow-600 animate-spin" />
            รอคณะทำงานใต้ร่มฯ จ่าย TRPB
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FeeBreakdown breakdown={breakdown} />
          <p className="text-xs text-muted-foreground">
            งานเสร็จสมบูรณ์แล้ว — คณะทำงานใต้ร่มฯ จะเป็นผู้ปล่อย TRPB ให้นักศึกษาตามสัดส่วน
            {hasMentor ? " 85/5/5/5" : " 90/5/5"} ภายในระยะเวลาอันสั้น
          </p>
          <div className="text-xs text-yellow-800 bg-yellow-100 rounded p-2 flex items-start gap-2">
            <Wallet className="size-3 mt-0.5 shrink-0" />
            <span>
              คุณไม่ต้องดำเนินการเพิ่มเติม — ระบบจะแจ้งเตือนเมื่อจ่ายเรียบร้อย
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // COMPLETED + staff viewing — release payment via API
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
          ปล่อยค่าจ้างจาก Escrow → แบ่งอัตโนมัติตามสัดส่วน {hasMentor ? "85/5/5/5" : "90/5/5"}
        </p>
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            {error}
          </p>
        )}
        <Button
          onClick={handleRelease}
          disabled={submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 h-11"
        >
          {submitting ? (
            <><Loader2 className="size-4 mr-2 animate-spin" />กำลังจ่ายค่าจ้าง...</>
          ) : (
            <><Wallet className="size-4 mr-2" />จ่ายค่าจ้าง {formatTRPB(payAmount)}</>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          การจ่ายจะหักจากยอด TRPB ของผู้ว่าจ้าง — ถ้ายอดไม่พอระบบจะ top-up จาก SYSTEM pool อัตโนมัติ (โหมดทดสอบ)
        </p>
      </CardContent>
    </Card>
  );
}

function FeeBreakdown({ breakdown }: { breakdown: ReturnType<typeof calculateFeeBreakdown> }) {
  // 3-way split (90/5/5) implemented in /api/jobs/[id]/release-escrow as of v2:
  // - 90% นักศึกษา (95% ถ้าไม่มี mentor)
  // - 5% กองทุนกลาง (SYSTEM pool)
  // - 5% คณะทำงาน (staff supervisor)
  // - 5% Mentor (เฉพาะงานที่ require mentor)
  const USE_FULL_SPLIT = true;
  if (!USE_FULL_SPLIT) {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex justify-between bg-green-50 rounded p-3 border border-green-200">
          <span className="text-muted-foreground">นักศึกษาได้รับ</span>
          <span className="font-medium text-green-700 text-base">{formatTRPB(breakdown.total)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          ⚠️ โหมด Pilot: นักศึกษาได้เต็มจำนวน · กองทุนกลาง/คณะทำงาน/Mentor ยังไม่หัก (จะเปิดในเฟสถัดไป)
        </p>
      </div>
    );
  }
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
