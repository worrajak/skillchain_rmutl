// SkillChain RMUTL — Database Types (ตาม MasterPlan v3)

export type UserRole = "student" | "employer" | "admin" | "teacher" | "donor" | "superadmin";

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
  created_at: string;
  updated_at: string;
}

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
