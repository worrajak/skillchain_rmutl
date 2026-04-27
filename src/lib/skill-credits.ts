/**
 * SkillCredit Business Logic
 * =============================
 * Off-chain operations for SkillCredit system.
 * Designed to work with or without on-chain sync.
 *
 * Flow:
 *   1. Work completed → calculate credits
 *   2. Insert transaction record
 *   3. Update balance (DB) — trigger auto-recalc level
 *   4. [Async] Submit to on-chain (SkillCredit contract) for transparency
 *   5. Notify user
 */

import { createNotification } from "@/lib/telegram";
import {
  calculateJobCredits,
  getSkillLevel,
  canAccessTier,
  getProgressToNextLevel,
  CREDIT_AWARDS,
  type SkillLevel,
  type JobTier,
  type SkillLevelInfo,
  SKILL_LEVELS,
} from "@/lib/terminology";

export type AwardReason =
  | "JOB_COMPLETION"
  | "TRAINING_COMPLETION"
  | "MENTORSHIP"
  | "VOLUNTEER"
  | "BONUS"
  | "CORRECTION";

// ============================================================================
// Get User's Credit Info
// ============================================================================

export interface CreditInfo {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRevoked: number;
  currentLevel: SkillLevel;
  levelInfo: SkillLevelInfo;
  progressToNext: ReturnType<typeof getProgressToNextLevel>;
}

export async function getCreditInfo(supabase: any, userId: string): Promise<CreditInfo | null> {
  const { data: balance } = await supabase
    .from("skc_credit_balances")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!balance) {
    // Initialize if doesn't exist
    await supabase.from("skc_credit_balances").insert({
      user_id: userId,
      balance: 0,
      lifetime_earned: 0,
      lifetime_revoked: 0,
    });
    return {
      userId,
      balance: 0,
      lifetimeEarned: 0,
      lifetimeRevoked: 0,
      currentLevel: "TRAINEE",
      levelInfo: SKILL_LEVELS[0],
      progressToNext: getProgressToNextLevel(0),
    };
  }

  const levelInfo = getSkillLevel(balance.lifetime_earned);

  return {
    userId,
    balance: balance.balance,
    lifetimeEarned: balance.lifetime_earned,
    lifetimeRevoked: balance.lifetime_revoked,
    currentLevel: balance.current_level,
    levelInfo,
    progressToNext: getProgressToNextLevel(balance.lifetime_earned),
  };
}

// ============================================================================
// Award Credits
// ============================================================================

export interface AwardCreditsParams {
  userId: string;
  amount: number;
  reason: AwardReason;
  jobId?: string;
  courseId?: string;
  note?: string;
  awardedBy?: string;
  txHash?: string;           // If submitted on-chain
  skipNotification?: boolean;
}

export interface AwardResult {
  ok: boolean;
  newBalance?: number;
  newLifetimeEarned?: number;
  leveledUp?: boolean;
  newLevel?: SkillLevel;
  error?: string;
}

export async function awardCredits(
  supabase: any,
  params: AwardCreditsParams
): Promise<AwardResult> {
  const { userId, amount, reason, jobId, courseId, note, awardedBy, txHash, skipNotification } = params;

  if (amount <= 0) return { ok: false, error: "amount must be positive" };

  // Get current info BEFORE update (to detect level-up)
  const before = await getCreditInfo(supabase, userId);
  const previousLevel = before?.currentLevel ?? "TRAINEE";

  // Insert transaction
  const { error: txErr } = await supabase.from("skc_credit_transactions").insert({
    user_id: userId,
    tx_type: "AWARD",
    amount,
    reason,
    reason_note: note,
    job_id: jobId,
    course_id: courseId,
    tx_hash: txHash,
    awarded_by: awardedBy,
  });

  if (txErr) return { ok: false, error: txErr.message };

  // Update balance (trigger will recalc level)
  // Use raw SQL to handle upsert + increment atomically
  const { data: updated, error: updateErr } = await supabase.rpc(
    "award_skill_credits",
    { p_user_id: userId, p_amount: amount }
  );

  // Fallback: if RPC doesn't exist, do it manually
  if (updateErr || !updated) {
    const { data: existing } = await supabase
      .from("skc_credit_balances")
      .select("balance, lifetime_earned")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("skc_credit_balances")
        .update({
          balance: existing.balance + amount,
          lifetime_earned: existing.lifetime_earned + amount,
        })
        .eq("user_id", userId);
    } else {
      await supabase.from("skc_credit_balances").insert({
        user_id: userId,
        balance: amount,
        lifetime_earned: amount,
      });
    }
  }

  // Get after state
  const after = await getCreditInfo(supabase, userId);
  if (!after) return { ok: false, error: "failed to fetch new balance" };

  const leveledUp = after.currentLevel !== previousLevel;

  // Notify user
  if (!skipNotification) {
    let title = `🏅 คุณได้รับ ${amount} แต้ม`;
    let body = reasonToMessage(reason, amount, note);

    if (leveledUp) {
      title = `🎉 เลื่อนระดับเป็น "${after.levelInfo.nameTh}" ${after.levelInfo.icon}`;
      body = `ยินดีด้วย! แต้มสะสม ${after.lifetimeEarned} แต้ม ${after.levelInfo.descriptionTh}`;
    }

    await createNotification(supabase, {
      user_id: userId,
      type: leveledUp ? "skill_level_up" : "skill_credits_earned",
      title,
      body,
      link: "/student/credits",
    });
  }

  return {
    ok: true,
    newBalance: after.balance,
    newLifetimeEarned: after.lifetimeEarned,
    leveledUp,
    newLevel: after.currentLevel,
  };
}

// ============================================================================
// Revoke Credits (admin only)
// ============================================================================

export async function revokeCredits(
  supabase: any,
  params: {
    userId: string;
    amount: number;
    reason: string;
    revokedBy: string;
  }
): Promise<AwardResult> {
  const { userId, amount, reason, revokedBy } = params;
  if (amount <= 0) return { ok: false, error: "amount must be positive" };

  const before = await getCreditInfo(supabase, userId);
  if (!before) return { ok: false, error: "user not found" };
  if (before.balance < amount) {
    return { ok: false, error: `แต้มไม่พอ (มี ${before.balance}, ต้องการหัก ${amount})` };
  }

  // Transaction record
  await supabase.from("skc_credit_transactions").insert({
    user_id: userId,
    tx_type: "REVOKE",
    amount,
    reason: "CORRECTION",
    reason_note: reason,
    awarded_by: revokedBy,
  });

  // Update balance (lifetime_revoked increases, but lifetime_earned stays same — level doesn't drop)
  await supabase
    .from("skc_credit_balances")
    .update({
      balance: before.balance - amount,
      lifetime_revoked: before.lifetimeRevoked + amount,
    })
    .eq("user_id", userId);

  // Notify
  await createNotification(supabase, {
    user_id: userId,
    type: "skill_credits_revoked",
    title: `⚠️ ถูกหักแต้ม ${amount} แต้ม`,
    body: `เหตุผล: ${reason}`,
    link: "/student/credits",
  });

  return { ok: true, newBalance: before.balance - amount };
}

// ============================================================================
// Tier Gate Check — ตรวจว่า user ผ่านระดับที่งานต้องการ
// ============================================================================

export interface TierGateResult {
  allowed: boolean;
  userLevel: SkillLevel;
  requiredLevel: SkillLevel;
  creditsNeeded: number;
  reason?: string;
}

export async function checkTierAccess(
  supabase: any,
  userId: string,
  requiredTier: JobTier
): Promise<TierGateResult> {
  const info = await getCreditInfo(supabase, userId);
  if (!info) {
    return {
      allowed: false,
      userLevel: "TRAINEE",
      requiredLevel: "TRAINEE",
      creditsNeeded: 0,
      reason: "ไม่พบข้อมูลผู้ใช้",
    };
  }

  const allowed = canAccessTier(info.lifetimeEarned, requiredTier);

  if (allowed) {
    return {
      allowed: true,
      userLevel: info.currentLevel,
      requiredLevel: info.levelInfo.level,
      creditsNeeded: 0,
    };
  }

  // Find required level
  const { SKILL_LEVELS: levels, TIER_REQUIREMENTS } = await import("@/lib/terminology");
  const requiredLevelCode = TIER_REQUIREMENTS[requiredTier];
  const requiredLevelInfo = levels.find(l => l.level === requiredLevelCode)!;
  const creditsNeeded = requiredLevelInfo.minLifetime - info.lifetimeEarned;

  return {
    allowed: false,
    userLevel: info.currentLevel,
    requiredLevel: requiredLevelCode,
    creditsNeeded,
    reason: `ต้องสะสมแต้มให้ถึงระดับ "${requiredLevelInfo.nameTh}" (ต้องอีก ${creditsNeeded} แต้ม)`,
  };
}

// ============================================================================
// Job Completion Hook — ใช้เรียกจาก work-certification หรือ job-complete
// ============================================================================

export async function awardCreditsForJobCompletion(
  supabase: any,
  params: {
    jobId: string;
    studentId: string;
    quality?: "excellent" | "good" | "fair";
    onTimeBonus?: boolean;
    safetyBonus?: boolean;
    awardedBy?: string;
    txHash?: string;
  }
): Promise<AwardResult> {
  const { jobId, studentId, quality = "good", onTimeBonus, safetyBonus, awardedBy, txHash } = params;

  // Get job tier
  const { data: job } = await supabase
    .from("skc_jobs")
    .select("required_tier, credits_on_completion, title")
    .eq("id", jobId)
    .single();

  if (!job) return { ok: false, error: "ไม่พบงาน" };

  // Calculate credits
  const tier = (job.required_tier ?? "TIER_1") as JobTier;
  let credits = job.credits_on_completion
    ? Math.round(job.credits_on_completion * (CREDIT_AWARDS.qualityBonus[quality] ?? 1))
    : calculateJobCredits(tier, quality);

  if (onTimeBonus) credits += CREDIT_AWARDS.onTimeBonus;
  if (safetyBonus) credits += CREDIT_AWARDS.safetyBonus;

  // Check duplicate (don't award twice for same job)
  const { data: existing } = await supabase
    .from("skc_credit_transactions")
    .select("id")
    .eq("job_id", jobId)
    .eq("user_id", studentId)
    .eq("reason", "JOB_COMPLETION")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "ได้รับแต้มสำหรับงานนี้แล้ว" };
  }

  return awardCredits(supabase, {
    userId: studentId,
    amount: credits,
    reason: "JOB_COMPLETION",
    jobId,
    note: `งาน "${job.title}" — คุณภาพ: ${quality}${onTimeBonus ? " + ตรงเวลา" : ""}${safetyBonus ? " + ความปลอดภัย" : ""}`,
    awardedBy,
    txHash,
  });
}

// ============================================================================
// Helper: สร้างข้อความแจ้งเตือน
// ============================================================================

function reasonToMessage(reason: AwardReason, amount: number, note?: string): string {
  const reasonLabels: Record<AwardReason, string> = {
    JOB_COMPLETION: `ทำงานเสร็จสมบูรณ์`,
    TRAINING_COMPLETION: `ผ่านการฝึกอบรม`,
    MENTORSHIP: `เป็นพี่เลี้ยงนักศึกษา`,
    VOLUNTEER: `งานอาสาสมัคร`,
    BONUS: `รางวัลพิเศษ`,
    CORRECTION: `ปรับปรุงข้อมูล`,
  };

  let msg = `${reasonLabels[reason]}: +${amount} แต้ม`;
  if (note) msg += ` — ${note}`;
  return msg;
}
