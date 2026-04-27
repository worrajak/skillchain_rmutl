/**
 * Centralized Terminology — Single source of truth for user-facing labels.
 *
 * Changing terminology here updates the entire app.
 *
 * LEGAL CONTEXT (Thai SEC Act B.E. 2561):
 *   SkillCredit must NEVER be referred to as:
 *   - "Coin", "Token", "Crypto", "เงินดิจิทัล", "เหรียญ", "สกุลเงิน"
 *
 *   ALWAYS use:
 *   - "แต้ม", "Credit", "Points", "คะแนนสะสม", "เครดิตทักษะ"
 *
 *   Hide from user-facing UI:
 *   - TRON wallet addresses
 *   - Transaction hashes (except in admin/audit views)
 *   - References to "Blockchain" as a financial instrument
 *     (OK to mention as "ระบบบันทึกที่ตรวจสอบได้")
 */

export const TERM = {
  // Credit system
  credit: {
    singular_th: "แต้ม",
    singular_en: "Credit",
    plural_th: "แต้ม",
    plural_en: "Credits",
    full_name_th: "เครดิตทักษะ",
    full_name_en: "SkillCredit",
    abbreviation: "SC",
    symbol: "🏅",
  },

  balance: {
    label_th: "แต้มสะสม",
    label_en: "Balance",
    description_th: "แต้มที่สะสมจากการทำงาน — ไม่สามารถแลกเงินหรือโอนให้ผู้อื่นได้",
  },

  lifetime: {
    label_th: "แต้มสะสมตลอดชีวิต",
    label_en: "Lifetime Earned",
    description_th: "จำนวนแต้มทั้งหมดที่เคยได้รับ ใช้ประเมินระดับทักษะ (ไม่ลดลงเมื่อถูกหักแต้ม)",
  },

  // Actions
  award: {
    label_th: "ได้รับแต้ม",
    label_en: "Award",
  },

  revoke: {
    label_th: "หักแต้ม",
    label_en: "Revoke",
  },

  // Blockchain layer — hidden from user, visible in admin
  ledger: {
    label_th: "ระบบบันทึกที่ตรวจสอบได้",
    label_en: "Verifiable Ledger",
    // Note: "Blockchain" OK in technical docs but NOT in user-facing UI
  },

  proof: {
    label_th: "หลักฐานการบันทึก",
    label_en: "Verification Record",
    // Never say "Transaction Hash" to end users
  },

  // Compensation (เงินจริง)
  compensation: {
    label_th: "ค่าตอบแทน",
    label_en: "Compensation",
    disclaimer_th: "ค่าตอบแทนเป็นเงินบาท จ่ายจากกองคลัง มทร.ล้านนา ตามระเบียบราชการ",
    disclaimer_en: "Compensation paid in Thai Baht by RMUTL Finance Office per regulations",
  },

  // Legal disclaimers
  disclaimer: {
    non_transferable_th: "⚠️ แต้ม SkillCredit ไม่สามารถโอนให้ผู้อื่นได้ ไม่สามารถแลกเปลี่ยนเป็นเงินสด และไม่ใช่สินทรัพย์ดิจิทัล",
    non_transferable_en: "⚠️ SkillCredits are non-transferable, cannot be exchanged for cash, and are NOT digital assets.",

    purpose_th: "แต้มใช้สำหรับประเมินระดับทักษะและปลดล็อคงานระดับสูงเท่านั้น",
    purpose_en: "Credits are used solely for skill assessment and unlocking higher-tier jobs.",
  },
} as const;

// ============================================================================
// Level System — Skill Levels (based on lifetime_earned)
// ============================================================================

export type SkillLevel = "TRAINEE" | "APPRENTICE" | "CERTIFIED" | "SENIOR" | "EXPERT";
export type JobTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5";

export interface SkillLevelInfo {
  level: SkillLevel;
  minLifetime: number;
  nameTh: string;
  nameEn: string;
  icon: string;
  color: string;
  descriptionTh: string;
  unlocksTier: JobTier;
}

export const SKILL_LEVELS: SkillLevelInfo[] = [
  {
    level: "TRAINEE",
    minLifetime: 0,
    nameTh: "ผู้ฝึกหัด",
    nameEn: "Trainee",
    icon: "🌱",
    color: "#94A3B8",
    descriptionTh: "ผู้เริ่มต้น — สามารถรับงานพื้นฐาน",
    unlocksTier: "TIER_1",
  },
  {
    level: "APPRENTICE",
    minLifetime: 100,
    nameTh: "ช่างฝึกหัด",
    nameEn: "Apprentice",
    icon: "🔧",
    color: "#60A5FA",
    descriptionTh: "ผ่านการฝึกงานพื้นฐาน — รับงานระดับกลางได้",
    unlocksTier: "TIER_2",
  },
  {
    level: "CERTIFIED",
    minLifetime: 500,
    nameTh: "ช่างที่ได้รับรอง",
    nameEn: "Certified",
    icon: "🏅",
    color: "#34D399",
    descriptionTh: "ช่างที่มีใบรับรอง — รับงานซ่อมบำรุงทั่วไปได้",
    unlocksTier: "TIER_3",
  },
  {
    level: "SENIOR",
    minLifetime: 2000,
    nameTh: "ช่างอาวุโส",
    nameEn: "Senior",
    icon: "⭐",
    color: "#FBBF24",
    descriptionTh: "ช่างเชี่ยวชาญ — รับงานยากและเป็นพี่เลี้ยงได้",
    unlocksTier: "TIER_4",
  },
  {
    level: "EXPERT",
    minLifetime: 5000,
    nameTh: "ช่างผู้เชี่ยวชาญ",
    nameEn: "Expert",
    icon: "💎",
    color: "#A78BFA",
    descriptionTh: "ผู้เชี่ยวชาญระดับสูงสุด — รับงานทุกระดับ",
    unlocksTier: "TIER_5",
  },
];

// ============================================================================
// Tier Requirements — Which level can access which job tier
// ============================================================================

export const TIER_REQUIREMENTS: Record<JobTier, SkillLevel> = {
  TIER_1: "TRAINEE",
  TIER_2: "APPRENTICE",
  TIER_3: "CERTIFIED",
  TIER_4: "SENIOR",
  TIER_5: "EXPERT",
};

export const TIER_LABELS: Record<JobTier, { th: string; en: string; description_th: string }> = {
  TIER_1: { th: "งานทั่วไป", en: "Basic", description_th: "งานพื้นฐาน ทุกคนสามารถรับได้" },
  TIER_2: { th: "งานระดับกลาง", en: "Intermediate", description_th: "ต้องเป็นช่างฝึกหัดขึ้นไป" },
  TIER_3: { th: "งานซ่อมบำรุง", en: "Advanced", description_th: "ต้องมีใบรับรองหรือสูงกว่า" },
  TIER_4: { th: "งานเชี่ยวชาญ", en: "Expert", description_th: "ต้องเป็นช่างอาวุโสขึ้นไป" },
  TIER_5: { th: "งานเฉพาะทาง", en: "Master", description_th: "เฉพาะช่างผู้เชี่ยวชาญเท่านั้น" },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getSkillLevel(lifetimeEarned: number): SkillLevelInfo {
  // Reverse search (highest level first)
  for (let i = SKILL_LEVELS.length - 1; i >= 0; i--) {
    if (lifetimeEarned >= SKILL_LEVELS[i].minLifetime) {
      return SKILL_LEVELS[i];
    }
  }
  return SKILL_LEVELS[0];
}

export function getNextLevel(lifetimeEarned: number): SkillLevelInfo | null {
  const current = getSkillLevel(lifetimeEarned);
  const idx = SKILL_LEVELS.findIndex(l => l.level === current.level);
  return idx < SKILL_LEVELS.length - 1 ? SKILL_LEVELS[idx + 1] : null;
}

export function getProgressToNextLevel(lifetimeEarned: number): {
  current: SkillLevelInfo;
  next: SkillLevelInfo | null;
  creditsToNext: number;
  progressPercent: number;
} {
  const current = getSkillLevel(lifetimeEarned);
  const next = getNextLevel(lifetimeEarned);

  if (!next) {
    return { current, next: null, creditsToNext: 0, progressPercent: 100 };
  }

  const range = next.minLifetime - current.minLifetime;
  const earned = lifetimeEarned - current.minLifetime;
  const creditsToNext = next.minLifetime - lifetimeEarned;
  const progressPercent = Math.min(100, Math.floor((earned / range) * 100));

  return { current, next, creditsToNext, progressPercent };
}

export function canAccessTier(lifetimeEarned: number, tier: JobTier): boolean {
  const userLevel = getSkillLevel(lifetimeEarned);
  const requiredLevel = TIER_REQUIREMENTS[tier];

  const levelOrder: SkillLevel[] = ["TRAINEE", "APPRENTICE", "CERTIFIED", "SENIOR", "EXPERT"];
  const userIdx = levelOrder.indexOf(userLevel.level);
  const requiredIdx = levelOrder.indexOf(requiredLevel);

  return userIdx >= requiredIdx;
}

export function getTierRequirement(tier: JobTier): { level: SkillLevel; info: SkillLevelInfo } {
  const requiredLevel = TIER_REQUIREMENTS[tier];
  const info = SKILL_LEVELS.find(l => l.level === requiredLevel)!;
  return { level: requiredLevel, info };
}

// ============================================================================
// Credit Award Formulas (how many SC per action)
// ============================================================================

export const CREDIT_AWARDS = {
  // Job completion by tier (base credits + quality bonus)
  jobCompletion: {
    TIER_1: 10,
    TIER_2: 25,
    TIER_3: 50,
    TIER_4: 100,
    TIER_5: 200,
  } as Record<JobTier, number>,

  // Quality bonus multiplier
  qualityBonus: {
    excellent: 2.0,  // ดีมาก
    good: 1.0,       // ดี
    fair: 0.5,       // พอใช้
  } as Record<string, number>,

  // Additional credits
  training: 50,        // Completed training course
  mentorship: 20,      // Per mentee per completed job
  volunteer: 15,       // Volunteer work
  onTimeBonus: 5,      // Submitted on time
  safetyBonus: 10,     // No safety incidents
} as const;

export function calculateJobCredits(tier: JobTier, quality: "excellent" | "good" | "fair" = "good"): number {
  const base = CREDIT_AWARDS.jobCompletion[tier];
  const multiplier = CREDIT_AWARDS.qualityBonus[quality];
  return Math.round(base * multiplier);
}
