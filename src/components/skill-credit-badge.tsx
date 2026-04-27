"use client";

import { useEffect, useState } from "react";
import { getSkillLevel, getProgressToNextLevel } from "@/lib/terminology";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  variant?: "compact" | "full";
  className?: string;
}

export default function SkillCreditBadge({ userId, variant = "compact", className }: Props) {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/skill-credits/balance/${userId}`)
      .then(r => r.json())
      .then(data => {
        setInfo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <div className={cn("text-xs text-muted-foreground", className)}>กำลังโหลด...</div>;
  }

  if (!info || info.error) {
    return null;
  }

  const level = info.levelInfo;
  const progress = info.progressToNext;

  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full border", className)}
           style={{ borderColor: level.color, backgroundColor: `${level.color}15` }}>
        <span className="text-lg">{level.icon}</span>
        <span className="text-sm font-medium" style={{ color: level.color }}>
          {level.nameTh}
        </span>
        <span className="text-xs text-muted-foreground">
          {info.balance.toLocaleString()} SC
        </span>
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{level.icon}</div>
          <div>
            <div className="text-sm text-muted-foreground">ระดับทักษะ</div>
            <div className="text-lg font-bold" style={{ color: level.color }}>
              {level.nameTh}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{info.balance.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">แต้มปัจจุบัน</div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-2">{level.descriptionTh}</div>

      {progress.next && (
        <>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>ระดับถัดไป: {progress.next.nameTh} {progress.next.icon}</span>
            <span>อีก {progress.creditsToNext.toLocaleString()} แต้ม</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${progress.progressPercent}%`,
                backgroundColor: level.color,
              }}
            />
          </div>
        </>
      )}

      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
        สะสมทั้งหมด: {info.lifetimeEarned.toLocaleString()} แต้ม
      </div>

      <div className="mt-2 text-[10px] text-muted-foreground italic">
        ⚠️ แต้มไม่สามารถแลกเป็นเงินสด หรือโอนให้ผู้อื่นได้
      </div>
    </div>
  );
}
