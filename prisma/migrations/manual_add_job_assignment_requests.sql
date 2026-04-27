-- Manual migration: add skc_job_assignment_requests table
-- Apply via Supabase Dashboard → SQL Editor
-- Matches prisma/schema.prisma model JobAssignmentRequest

CREATE TYPE "AssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "skc_job_assignment_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "AssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_assignment_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_assignment_requests_job_id_student_id_key"
  ON "skc_job_assignment_requests"("job_id", "student_id");
CREATE INDEX "job_assignment_requests_status_idx"
  ON "skc_job_assignment_requests"("status");
CREATE INDEX "job_assignment_requests_student_id_idx"
  ON "skc_job_assignment_requests"("student_id");

ALTER TABLE "skc_job_assignment_requests"
  ADD CONSTRAINT "job_assignment_requests_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "skc_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skc_job_assignment_requests"
  ADD CONSTRAINT "job_assignment_requests_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "skc_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional: trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_job_assignment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_job_assignment_requests_updated_at
  BEFORE UPDATE ON "skc_job_assignment_requests"
  FOR EACH ROW EXECUTE FUNCTION set_job_assignment_requests_updated_at();

-- Row Level Security (adjust to your existing policy pattern)
ALTER TABLE "skc_job_assignment_requests" ENABLE ROW LEVEL SECURITY;

-- Students can insert their own request
CREATE POLICY "student_insert_own_request" ON "skc_job_assignment_requests"
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Students can read their own requests
CREATE POLICY "student_read_own_request" ON "skc_job_assignment_requests"
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Staff/admin can read all and update
CREATE POLICY "staff_read_all_requests" ON "skc_job_assignment_requests"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skc_users
      WHERE skc_users.id = auth.uid()
        AND skc_users.role IN ('project_staff','rmutl_staff','admin','superadmin')
    )
  );

CREATE POLICY "staff_update_requests" ON "skc_job_assignment_requests"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skc_users
      WHERE skc_users.id = auth.uid()
        AND skc_users.role IN ('project_staff','rmutl_staff','admin','superadmin')
    )
  );
