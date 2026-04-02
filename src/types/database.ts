// SkillChain RMUTL — Database Types (ตาม MasterPlan v3)

export type UserRole = "student" | "employer" | "admin" | "teacher" | "donor" | "superadmin" | "project_staff" | "rmutl_staff";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type StudentTier = "trainee" | "apprentice" | "certified";

export type JobType = "PAID" | "VOLUNTEER" | "TRAINING" | "EXEMPTED";

export type JobStatus =
  | "OPEN"
  | "ASSIGNED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type HiringMode = "MODE_A" | "MODE_B" | "MODE_C";

export type JobCategory = "electrical" | "hvac" | "automotive" | "general";

export type BadgeLevel = "LOCKED" | "BASIC" | "TRUSTED" | "ELITE";

export type AvailabilityStatus = "available" | "busy" | "unavailable";

export type ExemptionType = "A" | "B" | "C";

// Credential System (5 Levels)
export type CredentialLevel = "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4" | "LEVEL_5";

export type CertifyingBody =
  | "SYSTEM"
  | "PROJECT_BARAMEE"
  | "RMUTL_TEACHER"
  | "DSD"
  | "TPQI"
  | "MASTER_TECH";

export type EvalPhase = "PRE_WORK" | "IN_PROGRESS" | "POST_WORK";

export const CREDENTIAL_LABELS: Record<CredentialLevel, { en: string; th: string; nft: string }> = {
  LEVEL_1: { en: "Registered", th: "ลงทะเบียน", nft: "none" },
  LEVEL_2: { en: "Project Certified", th: "ผ่านฝึกอบรมโครงการ", nft: "bronze" },
  LEVEL_3: { en: "Teacher Certified", th: "อาจารย์รับรอง", nft: "silver" },
  LEVEL_4: { en: "National Certified", th: "สถาบันระดับชาติรับรอง", nft: "gold" },
  LEVEL_5: { en: "Master Technician", th: "ช่างชำนาญการ", nft: "diamond" },
};

export const JOB_TYPE_REQUIRED_LEVEL: Record<JobType, CredentialLevel> = {
  TRAINING: "LEVEL_2",
  VOLUNTEER: "LEVEL_2",
  PAID: "LEVEL_3",
  EXEMPTED: "LEVEL_3",
};

export type DonorTier = "friend" | "supporter" | "patron" | "benefactor";

// --- Main Entities ---

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  campus: string;
  wallet_address: string | null;
  is_active: boolean;
  email_verified: boolean;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  // ข้อมูลเพิ่มเติมตาม role
  student_id_card: string | null;
  faculty: string | null;
  year_level: number | null;
  organization: string | null;
  org_registration: string | null;
  org_address: string | null;
  staff_position: string | null;
  teacher_id_card: string | null;
  created_at: string;
  updated_at: string;
}

// สิทธิ์ที่แต่ละ role สามารถยืนยัน role อื่นได้
export const APPROVAL_PERMISSIONS: Record<UserRole, UserRole[]> = {
  superadmin: ["admin", "teacher", "project_staff", "rmutl_staff", "employer", "student", "donor"],
  admin: ["teacher", "project_staff", "rmutl_staff", "employer", "student", "donor"],
  teacher: ["employer", "student"],
  project_staff: ["employer", "student", "donor"],
  rmutl_staff: ["student"],
  employer: [],
  student: [],
  donor: [],
};

export interface StudentTierRecord {
  id: string;
  student_id: string;
  tier: StudentTier;
  training_jobs_completed: number;
  avg_mentor_score: number;
  safety_incidents: number;
  promoted_at: string | null;
}

export interface StudentQualification {
  id: string;
  student_id: string;
  total_jobs: number;
  avg_score: number;
  success_rate: number;
  badge_level: BadgeLevel;
  max_job_value: number;
  suspended_until: string | null;
}

export interface StudentAvailability {
  student_id: string;
  status: AvailabilityStatus;
  busy_until: string | null;
  current_jobs: number;
  location: string | null;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  type: JobType;
  job_category: JobCategory;
  status: JobStatus;
  hiring_mode: HiringMode;
  is_mentorship: boolean;
  location: string;
  campus: string;
  pay_amount: number;
  deadline: string;
  employer_id: string;
  student_id: string | null;
  mentor_id: string | null;
  escrow_tx: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  job_id: string;
  student_id: string;
  teacher_id: string;
  score_quality: number;
  score_skill: number;
  score_time: number;
  score_tool: number;
  weighted_score: number;
  nft_tx_hash: string | null;
  created_at: string;
}

export interface MentorshipAssignment {
  id: string;
  job_id: string;
  mentor_id: string;
  trainee_ids: string[];
  mentor_share_pct: number;
  trainee_share_pct: number;
  fund_share_pct: number;
  platform_fee_pct: number;
}

export interface DonationFund {
  id: string;
  donor_id: string;
  amount: number;
  purpose: string;
  is_restricted: boolean;
  restriction_note: string | null;
  nft_tx_hash: string | null;
  created_at: string;
}

// --- Credentials ---

export interface StudentCredential {
  id: string;
  student_id: string;
  credential_level: CredentialLevel;
  certified_by: CertifyingBody;
  certified_by_user_id: string | null;
  certificate_ref: string | null;
  specialization: string | null;
  issued_at: string;
  expires_at: string | null;
  nft_tx_hash: string | null;
  is_active: boolean;
  created_at: string;
}

// --- Reviews ---

export interface EmployerReview {
  id: string;
  job_id: string;
  employer_id: string;
  student_id: string;
  score_quality: number;     // 1-5
  score_punctuality: number; // 1-5
  score_attitude: number;    // 1-5
  overall_rating: number;
  comment: string | null;
  created_at: string;
}

export interface StudentReview {
  id: string;
  job_id: string;
  student_id: string;
  employer_id: string;
  score_clarity: number;  // 1-5
  score_payment: number;  // 1-5
  score_safety: number;   // 1-5
  overall_rating: number;
  comment: string | null;
  created_at: string;
}

export interface MentorReview {
  id: string;
  job_id: string;
  mentor_id: string;
  trainee_id: string;
  score_effort: number;     // 1-4
  score_safety: number;     // 1-4
  score_skill_dev: number;  // 1-4
  weighted_score: number;
  comment: string | null;
  recommend_promotion: boolean;
  created_at: string;
}

export interface StudentRatingSummary {
  student_id: string;
  name: string;
  campus: string;
  avg_teacher_score: number;
  teacher_review_count: number;
  avg_employer_rating: number;
  employer_review_count: number;
  avg_mentor_score: number;
  mentor_review_count: number;
  combined_score: number;
}

export interface EmployerRatingSummary {
  employer_id: string;
  name: string;
  avg_rating: number;
  review_count: number;
  avg_clarity: number;
  avg_payment: number;
  avg_safety: number;
}

export interface BehaviorLog {
  id: string;
  user_id: string;
  job_id: string | null;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  penalty_applied: boolean;
  on_chain_tx: string | null;
  created_at: string;
}
