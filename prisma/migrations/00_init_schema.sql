-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'employer', 'admin', 'teacher', 'donor', 'superadmin', 'project_staff', 'rmutl_staff');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TierLevel" AS ENUM ('trainee', 'apprentice', 'certified');

-- CreateEnum
CREATE TYPE "BadgeLevel" AS ENUM ('LOCKED', 'BASIC', 'TRUSTED', 'ELITE');

-- CreateEnum
CREATE TYPE "CredentialLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5');

-- CreateEnum
CREATE TYPE "CertifyingBody" AS ENUM ('SYSTEM', 'PROJECT_BARAMEE', 'RMUTL_TEACHER', 'DSD', 'TPQI', 'MASTER_TECH');

-- CreateEnum
CREATE TYPE "EvalPhase" AS ENUM ('PRE_WORK', 'IN_PROGRESS', 'POST_WORK');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'busy', 'unavailable');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('PAID', 'VOLUNTEER', 'TRAINING', 'EXEMPTED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "HiringMode" AS ENUM ('MODE_A', 'MODE_B', 'MODE_C');

-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('electrical', 'hvac', 'automotive', 'general');

-- CreateEnum
CREATE TYPE "AssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('RAISED', 'UNDER_REVIEW', 'MEDIATION', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ApprovalLogAction" AS ENUM ('APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "skc_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "name" TEXT NOT NULL,
    "campus" TEXT NOT NULL DEFAULT 'huaykaew',
    "wallet_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "student_id_card" TEXT,
    "faculty" TEXT,
    "year_level" INTEGER,
    "organization" TEXT,
    "org_registration" TEXT,
    "org_address" TEXT,
    "staff_position" TEXT,
    "teacher_id_card" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "skc_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_student_tiers" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "tier" "TierLevel" NOT NULL DEFAULT 'trainee',
    "training_jobs_completed" INTEGER NOT NULL DEFAULT 0,
    "avg_mentor_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "safety_incidents" INTEGER NOT NULL DEFAULT 0,
    "promoted_at" TIMESTAMP(3),

    CONSTRAINT "skc_student_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_student_credentials" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "credential_level" "CredentialLevel" NOT NULL DEFAULT 'LEVEL_1',
    "certified_by" "CertifyingBody" NOT NULL DEFAULT 'SYSTEM',
    "certified_by_user_id" TEXT,
    "certificate_ref" TEXT,
    "specialization" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "nft_tx_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_student_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_student_qualifications" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "avg_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badge_level" "BadgeLevel" NOT NULL DEFAULT 'LOCKED',
    "max_job_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suspended_until" TIMESTAMP(3),

    CONSTRAINT "skc_student_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_student_availability" (
    "student_id" TEXT NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'available',
    "busy_until" TIMESTAMP(3),
    "current_jobs" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,

    CONSTRAINT "skc_student_availability_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "skc_jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "job_category" "JobCategory" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "hiring_mode" "HiringMode" NOT NULL DEFAULT 'MODE_A',
    "is_mentorship" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT NOT NULL,
    "campus" TEXT NOT NULL,
    "pay_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "employer_id" TEXT NOT NULL,
    "student_id" TEXT,
    "mentor_id" TEXT,
    "escrow_tx" TEXT,
    "eval_window_start" TIMESTAMP(3),
    "eval_window_end" TIMESTAMP(3),
    "eval_window_days" INTEGER NOT NULL DEFAULT 7,
    "approved_by_staff" TEXT,
    "staff_approval_at" TIMESTAMP(3),
    "work_start_date" TIMESTAMP(3),
    "work_end_date" TIMESTAMP(3),
    "schedule_proposed_by" TEXT,
    "schedule_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "staff_confirmed_completion" BOOLEAN NOT NULL DEFAULT false,
    "employer_confirmed_completion" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skc_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_job_assignment_requests" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "AssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skc_job_assignment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_evaluations" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "score_quality" DOUBLE PRECISION NOT NULL,
    "score_skill" DOUBLE PRECISION NOT NULL,
    "score_time" DOUBLE PRECISION NOT NULL,
    "score_tool" DOUBLE PRECISION NOT NULL,
    "weighted_score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "eval_phase" "EvalPhase" NOT NULL DEFAULT 'POST_WORK',
    "nft_tx_hash" TEXT,
    "on_chain_tx" TEXT,
    "content_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_donation_funds" (
    "id" TEXT NOT NULL,
    "donor_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "purpose" TEXT NOT NULL,
    "is_restricted" BOOLEAN NOT NULL DEFAULT false,
    "restriction_note" TEXT,
    "nft_tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_donation_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_employer_reviews" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "score_quality" INTEGER NOT NULL,
    "score_punctuality" INTEGER NOT NULL,
    "score_attitude" INTEGER NOT NULL,
    "overall_rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "eval_phase" "EvalPhase" NOT NULL DEFAULT 'POST_WORK',
    "on_chain_tx" TEXT,
    "content_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_employer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_student_reviews" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "score_clarity" INTEGER NOT NULL,
    "score_payment" INTEGER NOT NULL,
    "score_safety" INTEGER NOT NULL,
    "overall_rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "eval_phase" "EvalPhase" NOT NULL DEFAULT 'POST_WORK',
    "on_chain_tx" TEXT,
    "content_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_student_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_mentor_reviews" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "trainee_id" TEXT NOT NULL,
    "score_effort" INTEGER NOT NULL,
    "score_safety" INTEGER NOT NULL,
    "score_skill_dev" INTEGER NOT NULL,
    "weighted_score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "eval_phase" "EvalPhase" NOT NULL DEFAULT 'POST_WORK',
    "on_chain_tx" TEXT,
    "content_hash" TEXT,
    "recommend_promotion" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_mentor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_behavior_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT,
    "event_type" TEXT NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'low',
    "description" TEXT NOT NULL,
    "penalty_applied" BOOLEAN NOT NULL DEFAULT false,
    "on_chain_tx" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_behavior_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_job_chat_rooms" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "employer_id" TEXT,
    "student_id" TEXT,
    "mentor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_job_chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_chat_messages" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'TEXT',
    "content_hash" TEXT,
    "metadata" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_chat_participants" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_in_chat" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_job_cancellation_requests" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reason_detail" TEXT,
    "status" "CancellationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_job_cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_job_agreements" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "proposed_by" TEXT NOT NULL,
    "agreement_type" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_by" TEXT,
    "content_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_job_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_disputes" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "raised_by" TEXT NOT NULL,
    "raised_against" TEXT NOT NULL,
    "arbitrator_id" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_urls" JSONB,
    "status" "DisputeStatus" NOT NULL DEFAULT 'RAISED',
    "resolution_terms" TEXT,
    "resolved_at" TIMESTAMP(3),
    "content_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_approval_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "action" "ApprovalLogAction" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_approval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_fee_config" (
    "id" TEXT NOT NULL,
    "student_bps" INTEGER NOT NULL DEFAULT 8500,
    "fund_bps" INTEGER NOT NULL DEFAULT 500,
    "mentor_bps" INTEGER NOT NULL DEFAULT 500,
    "staff_bps" INTEGER NOT NULL DEFAULT 500,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skc_fee_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skc_student_rating_summary" (
    "student_id" TEXT NOT NULL,
    "name" TEXT,
    "campus" TEXT,
    "credential_level" TEXT,
    "credential_name" TEXT,
    "nft_tier" TEXT,
    "avg_teacher_score" DOUBLE PRECISION,
    "teacher_review_count" BIGINT,
    "avg_employer_rating" DOUBLE PRECISION,
    "employer_review_count" BIGINT,
    "avg_mentor_score" DOUBLE PRECISION,
    "mentor_review_count" BIGINT,
    "combined_score" DOUBLE PRECISION,

    CONSTRAINT "skc_student_rating_summary_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "skc_employer_rating_summary" (
    "employer_id" TEXT NOT NULL,
    "name" TEXT,
    "avg_rating" DOUBLE PRECISION,
    "review_count" BIGINT,
    "avg_clarity" DOUBLE PRECISION,
    "avg_payment" DOUBLE PRECISION,
    "avg_safety" DOUBLE PRECISION,

    CONSTRAINT "skc_employer_rating_summary_pkey" PRIMARY KEY ("employer_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skc_users_email_key" ON "skc_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "skc_users_wallet_address_key" ON "skc_users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "skc_student_tiers_student_id_key" ON "skc_student_tiers"("student_id");

-- CreateIndex
CREATE INDEX "skc_student_credentials_student_id_idx" ON "skc_student_credentials"("student_id");

-- CreateIndex
CREATE INDEX "skc_student_credentials_credential_level_idx" ON "skc_student_credentials"("credential_level");

-- CreateIndex
CREATE UNIQUE INDEX "skc_student_qualifications_student_id_key" ON "skc_student_qualifications"("student_id");

-- CreateIndex
CREATE INDEX "skc_jobs_status_idx" ON "skc_jobs"("status");

-- CreateIndex
CREATE INDEX "skc_jobs_type_idx" ON "skc_jobs"("type");

-- CreateIndex
CREATE INDEX "skc_jobs_campus_idx" ON "skc_jobs"("campus");

-- CreateIndex
CREATE INDEX "skc_jobs_employer_id_idx" ON "skc_jobs"("employer_id");

-- CreateIndex
CREATE INDEX "skc_jobs_student_id_idx" ON "skc_jobs"("student_id");

-- CreateIndex
CREATE INDEX "skc_job_assignment_requests_status_idx" ON "skc_job_assignment_requests"("status");

-- CreateIndex
CREATE INDEX "skc_job_assignment_requests_student_id_idx" ON "skc_job_assignment_requests"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "skc_job_assignment_requests_job_id_student_id_key" ON "skc_job_assignment_requests"("job_id", "student_id");

-- CreateIndex
CREATE INDEX "skc_employer_reviews_student_id_idx" ON "skc_employer_reviews"("student_id");

-- CreateIndex
CREATE INDEX "skc_employer_reviews_employer_id_idx" ON "skc_employer_reviews"("employer_id");

-- CreateIndex
CREATE UNIQUE INDEX "skc_employer_reviews_job_id_employer_id_student_id_key" ON "skc_employer_reviews"("job_id", "employer_id", "student_id");

-- CreateIndex
CREATE INDEX "skc_student_reviews_employer_id_idx" ON "skc_student_reviews"("employer_id");

-- CreateIndex
CREATE INDEX "skc_student_reviews_student_id_idx" ON "skc_student_reviews"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "skc_student_reviews_job_id_student_id_employer_id_key" ON "skc_student_reviews"("job_id", "student_id", "employer_id");

-- CreateIndex
CREATE INDEX "skc_mentor_reviews_trainee_id_idx" ON "skc_mentor_reviews"("trainee_id");

-- CreateIndex
CREATE INDEX "skc_mentor_reviews_mentor_id_idx" ON "skc_mentor_reviews"("mentor_id");

-- CreateIndex
CREATE UNIQUE INDEX "skc_mentor_reviews_job_id_mentor_id_trainee_id_key" ON "skc_mentor_reviews"("job_id", "mentor_id", "trainee_id");

-- CreateIndex
CREATE INDEX "skc_behavior_logs_user_id_idx" ON "skc_behavior_logs"("user_id");

-- CreateIndex
CREATE INDEX "skc_behavior_logs_event_type_idx" ON "skc_behavior_logs"("event_type");

-- CreateIndex
CREATE INDEX "skc_notifications_user_id_idx" ON "skc_notifications"("user_id");

-- CreateIndex
CREATE INDEX "skc_notifications_user_id_is_read_idx" ON "skc_notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "skc_job_chat_rooms_job_id_key" ON "skc_job_chat_rooms"("job_id");

-- CreateIndex
CREATE INDEX "skc_chat_messages_room_id_created_at_idx" ON "skc_chat_messages"("room_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "skc_chat_participants_room_id_user_id_key" ON "skc_chat_participants"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "skc_job_cancellation_requests_status_idx" ON "skc_job_cancellation_requests"("status");

-- CreateIndex
CREATE INDEX "skc_job_agreements_job_id_idx" ON "skc_job_agreements"("job_id");

-- CreateIndex
CREATE INDEX "skc_disputes_job_id_idx" ON "skc_disputes"("job_id");

-- CreateIndex
CREATE INDEX "skc_disputes_status_idx" ON "skc_disputes"("status");

-- CreateIndex
CREATE INDEX "skc_approval_logs_user_id_idx" ON "skc_approval_logs"("user_id");

-- AddForeignKey
ALTER TABLE "skc_student_tiers" ADD CONSTRAINT "skc_student_tiers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_student_credentials" ADD CONSTRAINT "skc_student_credentials_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_student_credentials" ADD CONSTRAINT "skc_student_credentials_certified_by_user_id_fkey" FOREIGN KEY ("certified_by_user_id") REFERENCES "skc_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_student_qualifications" ADD CONSTRAINT "skc_student_qualifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_student_availability" ADD CONSTRAINT "skc_student_availability_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_jobs" ADD CONSTRAINT "skc_jobs_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_jobs" ADD CONSTRAINT "skc_jobs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_jobs" ADD CONSTRAINT "skc_jobs_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "skc_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_job_assignment_requests" ADD CONSTRAINT "skc_job_assignment_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "skc_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_job_assignment_requests" ADD CONSTRAINT "skc_job_assignment_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_evaluations" ADD CONSTRAINT "skc_evaluations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "skc_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_evaluations" ADD CONSTRAINT "skc_evaluations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_evaluations" ADD CONSTRAINT "skc_evaluations_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_donation_funds" ADD CONSTRAINT "skc_donation_funds_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_employer_reviews" ADD CONSTRAINT "skc_employer_reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "skc_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_employer_reviews" ADD CONSTRAINT "skc_employer_reviews_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_employer_reviews" ADD CONSTRAINT "skc_employer_reviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_student_reviews" ADD CONSTRAINT "skc_student_reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "skc_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_student_reviews" ADD CONSTRAINT "skc_student_reviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_student_reviews" ADD CONSTRAINT "skc_student_reviews_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_mentor_reviews" ADD CONSTRAINT "skc_mentor_reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "skc_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_mentor_reviews" ADD CONSTRAINT "skc_mentor_reviews_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_mentor_reviews" ADD CONSTRAINT "skc_mentor_reviews_trainee_id_fkey" FOREIGN KEY ("trainee_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_behavior_logs" ADD CONSTRAINT "skc_behavior_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "skc_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_behavior_logs" ADD CONSTRAINT "skc_behavior_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "skc_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_chat_messages" ADD CONSTRAINT "skc_chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "skc_job_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skc_chat_participants" ADD CONSTRAINT "skc_chat_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "skc_job_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
