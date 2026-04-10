// SkillChain RMUTL — Database Types (ตาม MasterPlan v3)

export type UserRole = "student" | "employer" | "admin" | "teacher" | "donor" | "superadmin" | "project_staff" | "rmutl_staff" | "trainee";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type StudentTier = "trainee" | "apprentice" | "certified";

export type JobType = "PAID" | "VOLUNTEER" | "TRAINING" | "EXEMPTED";

export type JobStatus =
  | "PENDING_REVIEW"
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

export type EvalPhase = "PRE_WORK" | "IN_PROGRESS" | "POST_WORK" | "COMPETENCY_TEST";

// ==================== เกณฑ์การประเมิน 3 ระยะ ====================

// ระยะ 1: ก่อนเริ่มงาน — อาจารย์/คณะทำงาน ประเมินทักษะเบื้องต้น → กำหนด credential level
export const PRE_WORK_CRITERIA = {
  evaluator: ["teacher", "project_staff", "rmutl_staff", "admin"] as UserRole[],
  criteria: [
    { key: "basic_knowledge", label: "ความรู้พื้นฐานทางช่าง", max: 4 },
    { key: "tool_familiarity", label: "ความคุ้นเคยกับเครื่องมือ", max: 4 },
    { key: "safety_awareness", label: "ความตระหนักด้านความปลอดภัย", max: 4 },
    { key: "readiness", label: "ความพร้อมในการปฏิบัติงาน", max: 4 },
  ],
};

// ระยะ 2: ระหว่างทำงาน
// 2A: อาจารย์/คณะทำงาน ออก observe ร่วมทำงาน
export const DURING_WORK_OBSERVER_CRITERIA = {
  evaluator: ["teacher", "project_staff", "rmutl_staff", "admin"] as UserRole[],
  criteria: [
    { key: "practical_skill", label: "ทักษะการปฏิบัติงานจริง", max: 4 },
    { key: "problem_solving", label: "การแก้ปัญหาเฉพาะหน้า", max: 4 },
    { key: "work_process", label: "ลำดับขั้นตอนการทำงาน", max: 4 },
    { key: "safety_practice", label: "การปฏิบัติด้านความปลอดภัย", max: 4 },
  ],
};

// 2B: ผู้ว่าจ้าง ประเมินระหว่างทำงาน (พฤติกรรม/มารยาท)
export const DURING_WORK_EMPLOYER_CRITERIA = {
  evaluator: ["employer", "rmutl_staff"] as UserRole[],
  criteria: [
    { key: "knowledge", label: "องค์ความรู้ในงาน", max: 5 },
    { key: "discipline", label: "ความมีระเบียบวินัย/เรียบร้อย", max: 5 },
    { key: "behavior", label: "มารยาท/พฤติกรรม (ไม่หยิบของโดยไม่ถาม)", max: 5 },
    { key: "sense_engineer", label: "Sense Engineer/ความปลอดภัย", max: 5 },
  ],
};

// ระยะ 3: หลังงานเสร็จ
// 3A: ผู้ว่าจ้าง ประเมินผลงาน
export const POST_WORK_EMPLOYER_CRITERIA = {
  evaluator: ["employer", "rmutl_staff"] as UserRole[],
  criteria: [
    { key: "quality", label: "คุณภาพผลงาน", max: 5 },
    { key: "punctuality", label: "ตรงเวลา/ส่งงานตามกำหนด", max: 5 },
    { key: "cleanliness", label: "ความเรียบร้อยหลังทำงาน", max: 5 },
    { key: "overall_satisfaction", label: "ความพึงพอใจโดยรวม", max: 5 },
  ],
};

// 3B: อาจารย์/คณะทำงาน ประเมินทักษะรวม (สอบถามเพิ่มเติม → ให้ดาวเพิ่ม/เลื่อนระดับ)
export const POST_WORK_TEACHER_CRITERIA = {
  evaluator: ["teacher", "project_staff", "rmutl_staff", "admin"] as UserRole[],
  criteria: [
    { key: "skill_improvement", label: "ทักษะที่พัฒนาขึ้น", max: 4 },
    { key: "work_quality", label: "คุณภาพงานตามมาตรฐาน", max: 4 },
    { key: "attitude", label: "ทัศนคติ/ความรับผิดชอบ", max: 4 },
    { key: "recommend_level_up", label: "แนะนำเลื่อนระดับ", max: 4 },
  ],
};

// 3C: นศ. ประเมินผู้จ้าง
export const POST_WORK_STUDENT_CRITERIA = {
  criteria: [
    { key: "clarity", label: "งานชัดเจน/อธิบายดี", max: 5 },
    { key: "payment", label: "จ่ายเงินครบ/ตรงเวลา", max: 5 },
    { key: "safety_env", label: "สถานที่ปลอดภัย/อุปกรณ์พร้อม", max: 5 },
    { key: "respect", label: "ให้เกียรติ/สุภาพ", max: 5 },
  ],
};

// ระยะพิเศษ: ทดสอบสมรรถนะผ่านสถาบันภายนอก → เลื่อน credential
export const COMPETENCY_TEST_CRITERIA = {
  evaluator: ["admin", "project_staff"] as UserRole[],
  fields: [
    { key: "institution", label: "สถาบันที่ทดสอบ" },
    { key: "certificate_number", label: "เลขที่ใบรับรอง" },
    { key: "test_date", label: "วันที่ทดสอบ" },
    { key: "result", label: "ผลการทดสอบ" },
  ],
};

// Role ที่สร้างงาน (post job) ได้
export const JOB_POSTER_ROLES: UserRole[] = [
  "employer", "teacher", "project_staff", "rmutl_staff", "admin", "superadmin",
];

// ตรวจว่างานเป็น "งานจ้างเทียม" (สร้างโดย staff ไม่ใช่ employer ภายนอก)
export function isSimulatedJob(posterRole: UserRole): boolean {
  return ["teacher", "project_staff", "rmutl_staff", "admin", "superadmin"].includes(posterRole);
}

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

// Training System
export type CourseStatus = "DRAFT" | "OPEN_ENROLLMENT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TrainingProvider = "RMUTL_TEACHER" | "PROJECT_BARAMEE" | "DSD_PARTNER" | "TPQI_PARTNER" | "EXTERNAL";
export type PaymentMode = "VOLUNTEER" | "HYBRID";

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  category: JobCategory;
  provider: TrainingProvider;
  instructor_id: string;
  status: CourseStatus;
  start_date: string;
  end_date: string;
  total_hours: number;
  max_participants: number;
  min_participants: number;
  is_open_to_external: boolean;
  payment_mode: PaymentMode;
  hourly_rate_trpb: number;
  per_pass_rate_trpb: number;
  total_budget_trpb: number;
  pledged_trpb: number;
  grants_credential_level: CredentialLevel | null;
  cover_image_url: string | null;
  created_at: string;
}

export interface TrainingModule {
  id: string;
  course_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  competency_code: string | null;
  hours: number;
  pass_criteria: string;
}

export interface TrainingEnrollment {
  id: string;
  course_id: string;
  trainee_id: string;
  is_external: boolean;
  enrolled_at: string;
  completed_at: string | null;
  certificate_number: string | null;
  certificate_tx: string | null;
}

export interface ModuleAssessment {
  id: string;
  module_id: string;
  enrollment_id: string;
  passed: boolean;
  score: number | null;
  evidence_url: string | null;
  assessor_id: string;
  note: string | null;
  on_chain_tx: string | null;
  assessed_at: string;
}

export const COURSE_STATUS_LABELS: Record<CourseStatus, { label: string; color: string }> = {
  DRAFT: { label: "ร่าง", color: "bg-gray-100 text-gray-700" },
  OPEN_ENROLLMENT: { label: "เปิดรับสมัคร", color: "bg-green-100 text-green-800" },
  IN_PROGRESS: { label: "กำลังอบรม", color: "bg-cyan-100 text-cyan-800" },
  COMPLETED: { label: "เสร็จสิ้น", color: "bg-blue-100 text-blue-800" },
  CANCELLED: { label: "ยกเลิก", color: "bg-red-100 text-red-800" },
};

export const PROVIDER_LABELS: Record<TrainingProvider, string> = {
  RMUTL_TEACHER: "อาจารย์ มทร.ล้านนา",
  PROJECT_BARAMEE: "ทีมใต้ร่มพระบารมี",
  DSD_PARTNER: "สพร. (กรมพัฒนาฝีมือแรงงาน)",
  TPQI_PARTNER: "สคช. (สถาบันคุณวุฒิวิชาชีพ)",
  EXTERNAL: "วิทยากรภายนอก",
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
  wallet_private_key: string | null;
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
  avatar_url: string | null;
  job_quota: number;
  job_quota_used: number;
  created_at: string;
  updated_at: string;
}

export interface JobImage {
  id: string;
  job_id: string;
  image_url: string;
  image_type: "job" | "progress" | "completion";
  sort_order: number;
  uploaded_by: string;
  caption: string | null;
  created_at: string;
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
  trainee: [],
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
