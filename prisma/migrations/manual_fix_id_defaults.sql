-- ============================================================================
-- FIX: Add gen_random_uuid() defaults to skc_* tables
-- ============================================================================
-- Issue: Prisma @default(uuid()) generates UUIDs on the app side via Prisma
-- client. But Supabase client talks directly to Postgres without Prisma —
-- so id columns get NULL → violates NOT NULL constraint.
--
-- Solution: Add DEFAULT gen_random_uuid()::text to all primary keys.
-- ============================================================================
-- Note: 3 tables use FK as PK (no separate id column):
--   - skc_student_availability (student_id is PK)
--   - skc_student_rating_summary (student_id is PK)
--   - skc_employer_rating_summary (employer_id is PK)
-- These don't need defaults.
-- ============================================================================

-- Tables with id column and @default(uuid())
ALTER TABLE "skc_users"                     ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_student_tiers"             ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_student_credentials"       ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_student_qualifications"    ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_jobs"                      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_job_assignment_requests"   ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_evaluations"               ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_donation_funds"            ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_employer_reviews"          ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_student_reviews"           ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_mentor_reviews"            ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_behavior_logs"             ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_notifications"             ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_job_chat_rooms"            ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_chat_messages"             ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_chat_participants"         ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_job_cancellation_requests" ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_job_agreements"            ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_disputes"                  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_approval_logs"             ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "skc_fee_config"                ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Verify
SELECT table_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'skc_%'
  AND column_name = 'id'
ORDER BY table_name;
