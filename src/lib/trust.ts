/**
 * Isnad-based Trust System for SkillChain.
 *
 * อิงหลัก:
 * - Sanad (سند) — chain of report (who vouched for you)
 * - Matn (متن) — content of report (track record)
 * - Rijal (رجال) — identity verification
 *
 * ทุก trust event → log to skc_trust_events + recompute user's trust_score.
 *
 * ดู docs/ISNAD_TRUST_PROPOSAL.md สำหรับ design.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TrustGrade = "SAHIH" | "HASAN" | "DAIF" | "MAWDU";

export interface TrustGradeInfo {
  grade: TrustGrade;
  label: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  arabic: string;
  emoji: string;
}

export function getGrade(score: number): TrustGradeInfo {
  if (score >= 90) {
    return {
      grade: "SAHIH",
      label: "เชื่อถือสูงสุด",
      color: "emerald",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-100",
      borderColor: "border-emerald-300",
      arabic: "صحيح",
      emoji: "🟢",
    };
  }
  if (score >= 70) {
    return {
      grade: "HASAN",
      label: "เชื่อถือได้",
      color: "sky",
      textColor: "text-sky-700",
      bgColor: "bg-sky-100",
      borderColor: "border-sky-300",
      arabic: "حسن",
      emoji: "🔵",
    };
  }
  if (score >= 40) {
    return {
      grade: "DAIF",
      label: "ต้องตรวจสอบ",
      color: "amber",
      textColor: "text-amber-700",
      bgColor: "bg-amber-100",
      borderColor: "border-amber-300",
      arabic: "ضعيف",
      emoji: "🟡",
    };
  }
  return {
    grade: "MAWDU",
    label: "ไม่ผ่านเกณฑ์",
    color: "red",
    textColor: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
    arabic: "موضوع",
    emoji: "🔴",
  };
}

// =============================================================
// Trust event types (recognized in audit log)
// =============================================================

export type TrustEventType =
  | "COMPLETED_JOB"        // +5  · งานเสร็จสมบูรณ์
  | "NO_SHOW"              // -3  · ขาดกิจกรรม
  | "DISPUTE_LOST"         // -10 · ข้อพิพาทแพ้
  | "DISPUTE_WON"          // +3  · ข้อพิพาทชนะ
  | "REVIEW_HIGH"          // +2  · ได้รีวิวสูง (≥4 ดาว)
  | "REVIEW_LOW"           // -2  · ได้รีวิวต่ำ (≤2 ดาว)
  | "LATE_SUBMIT"          // -1  · ส่งงานเลยกำหนด
  | "IDENTITY_VERIFIED"    // +5  · ยืนยันตัวตน
  | "BATCH_APPROVED"       // +1  · batch เอกสารผ่านอนุมัติ (staff)
  | "VOUCHED_BY_SAHIH"     // +5  · มี Sahih user รับรอง
  | "MANUAL_ADJUST";       // staff override

export const TRUST_EVENT_DEFAULTS: Record<TrustEventType, { delta: number; reason: string }> = {
  COMPLETED_JOB: { delta: 5, reason: "งานเสร็จสมบูรณ์" },
  NO_SHOW: { delta: -3, reason: "ขาดกิจกรรมโดยไม่ลา" },
  DISPUTE_LOST: { delta: -10, reason: "ข้อพิพาทผลแพ้" },
  DISPUTE_WON: { delta: 3, reason: "ข้อพิพาทผลชนะ" },
  REVIEW_HIGH: { delta: 2, reason: "ได้รีวิว ≥4 ดาว" },
  REVIEW_LOW: { delta: -2, reason: "ได้รีวิว ≤2 ดาว" },
  LATE_SUBMIT: { delta: -1, reason: "ส่งงานเลยกำหนด" },
  IDENTITY_VERIFIED: { delta: 5, reason: "ยืนยันตัวตน" },
  BATCH_APPROVED: { delta: 1, reason: "Batch เอกสารผ่านอนุมัติ" },
  VOUCHED_BY_SAHIH: { delta: 5, reason: "Sahih user รับรอง" },
  MANUAL_ADJUST: { delta: 0, reason: "ปรับเองโดย admin" },
};

// =============================================================
// Server-side helpers (use service_role or rpc)
// =============================================================

/**
 * Record a trust event AND recompute the user's trust_score.
 *
 * Usage (from server API route):
 *   await recordTrustEvent(supabase, {
 *     userId: studentId,
 *     type: "COMPLETED_JOB",
 *     jobId: id,
 *     triggeredBy: staffId,
 *   });
 *
 * The score recompute uses the SQL fn fn_recompute_trust which factors in
 * ALL events + identity + chain, so the delta here is mainly for the audit
 * trail (the actual scoring is global, not just additive).
 */
export interface RecordEventOptions {
  userId: string;
  type: TrustEventType;
  delta?: number;            // override default
  reason?: string;
  jobId?: string;
  triggeredBy?: string;
}

export async function recordTrustEvent(
  supabase: SupabaseClient,
  opts: RecordEventOptions,
): Promise<void> {
  const defaults = TRUST_EVENT_DEFAULTS[opts.type] ?? { delta: 0, reason: opts.type };
  const delta = opts.delta ?? defaults.delta;
  const reason = opts.reason ?? defaults.reason;

  // Capture score before
  const { data: before } = await supabase
    .from("skc_users")
    .select("trust_score")
    .eq("id", opts.userId)
    .single();
  const scoreBefore = before?.trust_score ?? null;

  // Recompute (SQL fn factors in everything)
  const { data: newScore } = await supabase
    .rpc("fn_recompute_trust", { p_user_id: opts.userId });

  // Insert event row (audit log)
  await supabase.from("skc_trust_events").insert({
    user_id: opts.userId,
    event_type: opts.type,
    delta,
    reason,
    job_id: opts.jobId ?? null,
    triggered_by: opts.triggeredBy ?? null,
    score_before: scoreBefore,
    score_after: newScore ?? null,
  });
}

export async function recomputeTrust(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.rpc("fn_recompute_trust", { p_user_id: userId });
  return Number(data ?? 0);
}
