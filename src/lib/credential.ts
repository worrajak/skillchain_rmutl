import type { CredentialLevel, JobType, EvalPhase } from "@/types/database";
import { JOB_TYPE_REQUIRED_LEVEL, CREDENTIAL_LABELS } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

// ==================== Gate Check: สิทธิ์รับงาน ====================

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  currentLevel: CredentialLevel;
  requiredLevel: CredentialLevel;
  requiresMentor: boolean;
}

const LEVEL_ORDER: CredentialLevel[] = [
  "LEVEL_1",
  "LEVEL_2",
  "LEVEL_3",
  "LEVEL_4",
  "LEVEL_5",
];

function levelNum(level: CredentialLevel): number {
  return LEVEL_ORDER.indexOf(level) + 1;
}

export async function checkJobEligibility(
  supabase: SupabaseClient,
  studentId: string,
  jobType: JobType,
  isMentorship: boolean = false
): Promise<EligibilityResult> {
  // หา credential level สูงสุดที่ active
  const { data } = await supabase
    .from("student_credentials")
    .select("credential_level")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .order("credential_level", { ascending: false })
    .limit(1)
    .single();

  const currentLevel: CredentialLevel = data?.credential_level ?? "LEVEL_1";
  const requiredLevel = JOB_TYPE_REQUIRED_LEVEL[jobType];

  const currentNum = levelNum(currentLevel);
  const requiredNum = levelNum(requiredLevel);

  if (currentNum < requiredNum) {
    const reqLabel = CREDENTIAL_LABELS[requiredLevel];
    return {
      eligible: false,
      reason: `ต้องมี credential ระดับ ${requiredNum} (${reqLabel.th}) ขึ้นไป`,
      currentLevel,
      requiredLevel,
      requiresMentor: false,
    };
  }

  // Lv.2 ต้องมี Mentor สำหรับ TRAINING / VOLUNTEER
  const requiresMentor =
    currentLevel === "LEVEL_2" &&
    (jobType === "TRAINING" || jobType === "VOLUNTEER") &&
    !isMentorship;

  return {
    eligible: true,
    reason: "ผ่าน",
    currentLevel,
    requiredLevel,
    requiresMentor,
  };
}

// ตรวจสอบสิทธิ์เป็น Mentor (ต้อง Lv.4+)
export function canBeMentor(level: CredentialLevel): boolean {
  return levelNum(level) >= 4;
}

// ตรวจสอบสิทธิ์รับเหมา (ต้อง Lv.5)
export function canContract(level: CredentialLevel): boolean {
  return level === "LEVEL_5";
}

// ตรวจสอบสิทธิ์รับรองผู้อื่น (ต้อง Lv.5)
export function canCertifyOthers(level: CredentialLevel): boolean {
  return level === "LEVEL_5";
}

// ==================== Evaluation Window Check ====================

export interface EvalWindowResult {
  canEvaluate: boolean;
  reason: string;
  phase: EvalPhase;
  daysRemaining?: number;
}

export function checkEvalWindow(
  jobStatus: string,
  evalWindowStart: string | null,
  evalWindowEnd: string | null
): EvalWindowResult {
  const now = new Date();

  // ก่อนเริ่มงาน
  if (jobStatus === "ASSIGNED" || jobStatus === "CONFIRMED") {
    return {
      canEvaluate: true,
      reason: "ประเมินความพร้อมก่อนเริ่มงาน",
      phase: "PRE_WORK",
    };
  }

  // ระหว่างทำงาน
  if (jobStatus === "IN_PROGRESS") {
    return {
      canEvaluate: true,
      reason: "บันทึก progress ระหว่างทำงาน",
      phase: "IN_PROGRESS",
    };
  }

  // หลังงานเสร็จ
  if (
    jobStatus === "COMPLETED" ||
    jobStatus === "SUBMITTED"
  ) {
    if (!evalWindowStart || !evalWindowEnd) {
      return {
        canEvaluate: true,
        reason: "รอระบบเปิดหน้าต่างประเมิน",
        phase: "POST_WORK",
      };
    }

    const windowEnd = new Date(evalWindowEnd);
    if (now > windowEnd) {
      return {
        canEvaluate: false,
        reason: "หมดเขตการประเมิน ต้องขออนุมัติจาก admin",
        phase: "POST_WORK",
        daysRemaining: 0,
      };
    }

    const daysRemaining = Math.ceil(
      (windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      canEvaluate: true,
      reason: `เหลือเวลาประเมินอีก ${daysRemaining} วัน`,
      phase: "POST_WORK",
      daysRemaining,
    };
  }

  return {
    canEvaluate: false,
    reason: "งานยังไม่อยู่ในสถานะที่สามารถประเมินได้",
    phase: "POST_WORK",
  };
}

// ==================== Content Hash (for on-chain verification) ====================

export async function hashReviewContent(content: Record<string, unknown>): Promise<string> {
  const json = JSON.stringify(content, Object.keys(content).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
