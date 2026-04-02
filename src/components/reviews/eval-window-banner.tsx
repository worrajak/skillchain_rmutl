"use client";

import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import type { EvalPhase } from "@/types/database";

interface EvalWindowBannerProps {
  canEvaluate: boolean;
  reason: string;
  phase: EvalPhase;
  daysRemaining?: number;
}

const phaseLabels: Record<EvalPhase, string> = {
  PRE_WORK: "ก่อนเริ่มงาน",
  IN_PROGRESS: "ระหว่างทำงาน",
  POST_WORK: "หลังงานเสร็จ",
};

export function EvalWindowBanner({
  canEvaluate,
  reason,
  phase,
  daysRemaining,
}: EvalWindowBannerProps) {
  if (!canEvaluate) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
        <AlertTriangle className="size-5 shrink-0 text-red-500" />
        <div>
          <div className="font-medium text-red-800">ไม่สามารถประเมินได้</div>
          <div className="text-red-600">{reason}</div>
        </div>
      </div>
    );
  }

  const isUrgent = daysRemaining !== undefined && daysRemaining <= 2;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4 text-sm",
        isUrgent
          ? "border-yellow-200 bg-yellow-50"
          : "border-blue-200 bg-blue-50"
      )}
    >
      {phase === "PRE_WORK" && (
        <CheckCircle className="size-5 shrink-0 text-blue-500" />
      )}
      {phase === "IN_PROGRESS" && (
        <Loader2 className="size-5 shrink-0 text-blue-500 animate-spin" />
      )}
      {phase === "POST_WORK" && (
        <Clock
          className={cn(
            "size-5 shrink-0",
            isUrgent ? "text-yellow-600" : "text-blue-500"
          )}
        />
      )}
      <div>
        <div
          className={cn(
            "font-medium",
            isUrgent ? "text-yellow-800" : "text-blue-800"
          )}
        >
          ช่วง: {phaseLabels[phase]}
        </div>
        <div
          className={cn(isUrgent ? "text-yellow-700" : "text-blue-600")}
        >
          {reason}
        </div>
      </div>
    </div>
  );
}

// On-chain verification stamp
export function OnChainStamp({
  txHash,
  contentHash,
}: {
  txHash?: string | null;
  contentHash?: string | null;
}) {
  if (!txHash) return null;

  const shortHash = txHash.slice(0, 8) + "..." + txHash.slice(-6);

  return (
    <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs">
      <div className="flex size-5 items-center justify-center rounded-full bg-green-500 text-white">
        <CheckCircle className="size-3" />
      </div>
      <div>
        <div className="font-medium text-green-800">
          On-chain verified
        </div>
        <div className="text-green-600 font-mono">
          TX: {shortHash}
        </div>
        {contentHash && (
          <div className="text-green-500 font-mono text-[10px]">
            Hash: {contentHash.slice(0, 12)}...
          </div>
        )}
      </div>
    </div>
  );
}
