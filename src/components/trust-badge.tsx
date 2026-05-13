"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getGrade, type TrustGrade } from "@/lib/trust";
import { cn } from "@/lib/utils";

/**
 * TrustBadge — small badge แสดง trust grade (Sahih / Hasan / Da'if / Mawdu')
 * อิงหลักอิสนาดของศาสตร์หะดีษ
 *
 * Sizes:
 *   xs: just emoji + arabic (16px)
 *   sm: emoji + arabic + score (compact pill)
 *   md: full label + score
 *   lg: hero — emoji + arabic + thai label + score
 */

interface TrustBadgeProps {
  userId?: string | null;
  score?: number | null;
  grade?: TrustGrade | null;
  size?: "xs" | "sm" | "md" | "lg";
  showScore?: boolean;
  showLabel?: boolean;
  showArabic?: boolean;
  className?: string;
}

// Module-level cache (1 fetch per user per page)
const cache = new Map<string, { score: number; grade: TrustGrade }>();
const pending = new Map<string, Promise<void>>();

async function fetchTrust(id: string) {
  if (cache.has(id)) return;
  const existing = pending.get(id);
  if (existing) return existing;
  const p = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("skc_users")
      .select("trust_score, trust_grade")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      cache.set(id, {
        score: Number(data.trust_score ?? 0),
        grade: (data.trust_grade as TrustGrade) ?? "MAWDU",
      });
    }
    pending.delete(id);
  })();
  pending.set(id, p);
  return p;
}

export function TrustBadge({
  userId,
  score: scoreProp,
  grade: gradeProp,
  size = "sm",
  showScore = true,
  showLabel = false,
  showArabic = true,
  className,
}: TrustBadgeProps) {
  const [fetched, setFetched] = useState<{ score: number; grade: TrustGrade } | null>(null);

  useEffect(() => {
    if (scoreProp != null && gradeProp) return;
    if (!userId) return;
    if (cache.has(userId)) {
      setFetched(cache.get(userId)!);
      return;
    }
    let cancelled = false;
    fetchTrust(userId).then(() => {
      if (cancelled) return;
      const v = cache.get(userId);
      if (v) setFetched(v);
    });
    return () => { cancelled = true; };
  }, [userId, scoreProp, gradeProp]);

  const score = scoreProp ?? fetched?.score ?? 0;
  const grade = gradeProp ?? fetched?.grade ?? "MAWDU";
  const info = getGrade(score);

  const sizeClasses: Record<typeof size, string> = {
    xs: "text-[10px] px-1.5 py-0.5 gap-0.5",
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  };

  return (
    <span
      title={`Isnad trust: ${info.label} (${score.toFixed(0)}/100)`}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        info.bgColor,
        info.textColor,
        info.borderColor,
        sizeClasses[size],
        className,
      )}
    >
      <span>{info.emoji}</span>
      {showArabic && size !== "xs" && (
        <span className="font-bold" style={{ fontFamily: "serif" }}>{info.arabic}</span>
      )}
      {showLabel && size === "lg" && <span>{info.label}</span>}
      {showScore && <span className="font-bold tabular-nums">{Math.round(score)}</span>}
    </span>
  );
  void grade; // grade unused at runtime — derived from score
}
