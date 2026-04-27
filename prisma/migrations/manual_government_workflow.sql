-- ============================================================================
-- Phase 1: Government Workflow Integration (ระบบเอกสารราชการคู่ขนาน)
-- ============================================================================
-- เพิ่มระบบติดตามเอกสารราชการคู่ขนานกับ Blockchain track
-- ครอบคลุม: อนุมัติโครงการ, อนุมัติกิจกรรม, สัญญาจ้าง, timesheet, ใบรับรอง, ใบเบิก
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "GovWorkflowStatus" AS ENUM (
    'DRAFT',
    'PROJECT_APPROVAL_PENDING',
    'PROJECT_APPROVED',
    'ACTIVITY_APPROVAL_PENDING',
    'ACTIVITY_APPROVED',
    'CONTRACT_PENDING',
    'CONTRACT_SIGNED',
    'IN_PROGRESS',
    'WORK_CERTIFIED',
    'DISBURSEMENT_PENDING',
    'DISBURSEMENT_APPROVED',
    'PAID',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OfficialDocType" AS ENUM (
    'PROJECT_APPROVAL',         -- บันทึกขออนุมัติโครงการ
    'ACTIVITY_APPROVAL',        -- บันทึกขออนุมัติกิจกรรม
    'COMMITTEE_ORDER',          -- คำสั่งแต่งตั้งคณะทำงาน
    'EMPLOYMENT_CONTRACT',      -- สัญญาจ้าง นศ.
    'TIMESHEET',                -- ใบลงเวลาปฏิบัติงาน
    'WORK_CERTIFICATION',       -- ใบรับรองการปฏิบัติงาน
    'PAYMENT_RECEIPT',          -- ใบสำคัญรับเงิน
    'DISBURSEMENT_REQUEST',     -- แบบขอเบิกค่าตอบแทน
    'DISBURSEMENT_CERT',        -- หนังสือรับรองการเบิกจ่าย
    'PROJECT_REPORT'            -- รายงานผลการดำเนินโครงการ
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM (
    'DRAFT',
    'PENDING_SIGNATURE',
    'SIGNED',
    'APPROVED',
    'REJECTED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 2. Parent Projects (โครงการแม่ — ขออนุมัติครั้งเดียว/ปี)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_gov_projects" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  project_code    TEXT UNIQUE,
  fiscal_year     INTEGER NOT NULL,
  budget_source   TEXT,                          -- งบประมาณ: งบประจำ/งบวิจัย/งบบริการวิชาการ/อื่นๆ
  total_budget    NUMERIC(14, 2) DEFAULT 0,
  used_budget     NUMERIC(14, 2) DEFAULT 0,
  description     TEXT,
  -- Approval
  requested_by    UUID REFERENCES "skc_users"(id),
  approved_by     UUID REFERENCES "skc_users"(id),
  approved_at     TIMESTAMPTZ,
  approval_ref    TEXT,                          -- เลขที่หนังสือ/บันทึกอนุมัติ
  approval_doc_url TEXT,
  status          "DocumentStatus" DEFAULT 'DRAFT',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_projects_year ON "skc_gov_projects"(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_gov_projects_status ON "skc_gov_projects"(status);

-- ----------------------------------------------------------------------------
-- 3. Activity Approvals (อนุมัติกิจกรรมย่อย — ทุกงาน)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_activity_approvals" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES "skc_gov_projects"(id) ON DELETE CASCADE,
  job_id            UUID REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  activity_title    TEXT NOT NULL,
  activity_code     TEXT,
  description       TEXT,
  -- Scope
  num_students      INTEGER DEFAULT 1,
  total_hours       NUMERIC(8, 2) DEFAULT 0,
  rate_per_hour     NUMERIC(10, 2) DEFAULT 0,
  total_compensation NUMERIC(14, 2) DEFAULT 0,
  start_date        DATE,
  end_date          DATE,
  location          TEXT,
  -- Approval chain
  requested_by      UUID REFERENCES "skc_users"(id),
  requested_at      TIMESTAMPTZ,
  approved_by       UUID REFERENCES "skc_users"(id),      -- ผู้อนุมัติ (default: คณบดี)
  approved_at       TIMESTAMPTZ,
  approval_ref      TEXT,
  approval_doc_url  TEXT,
  rejection_reason  TEXT,
  status            "DocumentStatus" DEFAULT 'DRAFT',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_approvals_project ON "skc_activity_approvals"(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_approvals_job ON "skc_activity_approvals"(job_id);
CREATE INDEX IF NOT EXISTS idx_activity_approvals_status ON "skc_activity_approvals"(status);

-- ----------------------------------------------------------------------------
-- 4. Employment Contracts (สัญญาจ้าง นศ.)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_gov_contracts" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id       UUID REFERENCES "skc_activity_approvals"(id) ON DELETE CASCADE,
  job_id            UUID REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES "skc_users"(id),
  contract_ref      TEXT,                          -- เลขที่สัญญา
  contract_date     DATE,
  start_date        DATE,
  end_date          DATE,
  total_hours       NUMERIC(8, 2),
  rate_per_hour     NUMERIC(10, 2),
  total_amount      NUMERIC(14, 2),
  terms             TEXT,
  student_signed_at TIMESTAMPTZ,
  employer_signed_at TIMESTAMPTZ,
  staff_signed_at   TIMESTAMPTZ,
  contract_doc_url  TEXT,
  status            "DocumentStatus" DEFAULT 'DRAFT',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_contracts_job ON "skc_gov_contracts"(job_id);
CREATE INDEX IF NOT EXISTS idx_gov_contracts_student ON "skc_gov_contracts"(student_id);

-- ----------------------------------------------------------------------------
-- 5. Timesheets (ใบลงเวลา)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_gov_timesheets" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES "skc_users"(id),
  work_date         DATE NOT NULL,
  time_in           TIMESTAMPTZ,
  time_out          TIMESTAMPTZ,
  hours             NUMERIC(5, 2),
  task_description  TEXT,
  -- Verification
  verified_by       UUID REFERENCES "skc_users"(id),    -- พี่เลี้ยง/หัวหน้างาน
  verified_at       TIMESTAMPTZ,
  -- Linked from checkin system
  checkin_id        UUID REFERENCES "skc_job_checkins"(id),
  checkout_id       UUID REFERENCES "skc_job_checkins"(id),
  status            "DocumentStatus" DEFAULT 'DRAFT',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_timesheets_job ON "skc_gov_timesheets"(job_id);
CREATE INDEX IF NOT EXISTS idx_gov_timesheets_student ON "skc_gov_timesheets"(student_id);
CREATE INDEX IF NOT EXISTS idx_gov_timesheets_date ON "skc_gov_timesheets"(work_date);

-- ----------------------------------------------------------------------------
-- 6. Work Certifications (ใบรับรองการปฏิบัติงาน)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_work_certifications" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id       UUID REFERENCES "skc_activity_approvals"(id),
  job_id            UUID REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES "skc_users"(id),
  cert_ref          TEXT,                          -- เลขที่ใบรับรอง
  cert_date         DATE,
  -- Work summary
  total_hours_actual NUMERIC(8, 2),
  work_quality      TEXT,                          -- ดี/ดีมาก/พอใช้
  work_summary      TEXT,
  -- Signatures
  certified_by_employer UUID REFERENCES "skc_users"(id),
  certified_by_mentor   UUID REFERENCES "skc_users"(id),
  certified_by_staff    UUID REFERENCES "skc_users"(id),
  employer_signed_at    TIMESTAMPTZ,
  mentor_signed_at      TIMESTAMPTZ,
  staff_signed_at       TIMESTAMPTZ,
  cert_doc_url      TEXT,
  status            "DocumentStatus" DEFAULT 'DRAFT',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_cert_job ON "skc_work_certifications"(job_id);
CREATE INDEX IF NOT EXISTS idx_work_cert_student ON "skc_work_certifications"(student_id);

-- ----------------------------------------------------------------------------
-- 7. Disbursements (ใบเบิกค่าตอบแทน)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_disbursements" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id       UUID REFERENCES "skc_activity_approvals"(id),
  disbursement_ref  TEXT,                          -- เลขที่ใบเบิก
  fiscal_period     TEXT,                          -- งวด เช่น "2569-Q1"
  -- Items (jsonb array of {student_id, name, hours, rate, amount})
  items             JSONB DEFAULT '[]'::jsonb,
  total_amount      NUMERIC(14, 2) DEFAULT 0,
  -- Approval chain
  requested_by      UUID REFERENCES "skc_users"(id),
  requested_at      TIMESTAMPTZ,
  head_approved_by  UUID REFERENCES "skc_users"(id),   -- หัวหน้าโครงการ
  head_approved_at  TIMESTAMPTZ,
  finance_approved_by UUID REFERENCES "skc_users"(id), -- การเงิน
  finance_approved_at TIMESTAMPTZ,
  final_approved_by UUID REFERENCES "skc_users"(id),   -- รองอธิการ/อธิการ
  final_approved_at TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  payment_method    TEXT,                          -- transfer/cash/cheque
  payment_ref       TEXT,                          -- เลขที่โอน/เช็ค
  -- Documents
  request_doc_url   TEXT,
  approval_doc_url  TEXT,
  receipt_doc_url   TEXT,
  status            "DocumentStatus" DEFAULT 'DRAFT',
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disbursements_activity ON "skc_disbursements"(activity_id);
CREATE INDEX IF NOT EXISTS idx_disbursements_status ON "skc_disbursements"(status);

-- ----------------------------------------------------------------------------
-- 8. Official Documents Registry (ทะเบียนเอกสารราชการทั้งหมด)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_official_documents" (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type          "OfficialDocType" NOT NULL,
  doc_ref           TEXT,                          -- เลขที่เอกสาร
  doc_date          DATE,
  title             TEXT,
  -- Related entities
  project_id        UUID REFERENCES "skc_gov_projects"(id) ON DELETE SET NULL,
  activity_id       UUID REFERENCES "skc_activity_approvals"(id) ON DELETE SET NULL,
  job_id            UUID REFERENCES "skc_jobs"(id) ON DELETE SET NULL,
  disbursement_id   UUID REFERENCES "skc_disbursements"(id) ON DELETE SET NULL,
  -- File storage
  file_url          TEXT NOT NULL,
  file_size         INTEGER,
  generated_from    TEXT,                          -- template name
  -- Lifecycle
  generated_by      UUID REFERENCES "skc_users"(id),
  generated_at      TIMESTAMPTZ DEFAULT NOW(),
  signed_at         TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  status            "DocumentStatus" DEFAULT 'DRAFT',
  metadata          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_official_docs_type ON "skc_official_documents"(doc_type);
CREATE INDEX IF NOT EXISTS idx_official_docs_job ON "skc_official_documents"(job_id);
CREATE INDEX IF NOT EXISTS idx_official_docs_activity ON "skc_official_documents"(activity_id);

-- ----------------------------------------------------------------------------
-- 9. Add Government Workflow State to Jobs
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_jobs"
  ADD COLUMN IF NOT EXISTS gov_status "GovWorkflowStatus" DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS gov_project_id UUID REFERENCES "skc_gov_projects"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gov_activity_id UUID REFERENCES "skc_activity_approvals"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_gov_status ON "skc_jobs"(gov_status);

-- ----------------------------------------------------------------------------
-- 10. Workflow Step Log (audit trail)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "skc_gov_workflow_log" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  activity_id     UUID REFERENCES "skc_activity_approvals"(id) ON DELETE CASCADE,
  from_status     "GovWorkflowStatus",
  to_status       "GovWorkflowStatus" NOT NULL,
  actor_id        UUID REFERENCES "skc_users"(id),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_log_job ON "skc_gov_workflow_log"(job_id);
CREATE INDEX IF NOT EXISTS idx_gov_log_activity ON "skc_gov_workflow_log"(activity_id);

-- ----------------------------------------------------------------------------
-- 11. RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_gov_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_activity_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_gov_contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_gov_timesheets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_work_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_disbursements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_official_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skc_gov_workflow_log" ENABLE ROW LEVEL SECURITY;

-- Staff และ admin อ่านได้ทั้งหมด
DROP POLICY IF EXISTS "gov_projects_read" ON "skc_gov_projects";
CREATE POLICY "gov_projects_read" ON "skc_gov_projects" FOR SELECT
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "gov_projects_write" ON "skc_gov_projects";
CREATE POLICY "gov_projects_write" ON "skc_gov_projects" FOR ALL
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff')
    )
  );

DROP POLICY IF EXISTS "activity_approvals_read" ON "skc_activity_approvals";
CREATE POLICY "activity_approvals_read" ON "skc_activity_approvals" FOR SELECT
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher', 'employer')
    )
    OR
    job_id IN (SELECT id FROM "skc_jobs" WHERE student_id = auth.uid()::uuid OR employer_id = auth.uid()::uuid)
  );

DROP POLICY IF EXISTS "activity_approvals_write" ON "skc_activity_approvals";
CREATE POLICY "activity_approvals_write" ON "skc_activity_approvals" FOR ALL
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "gov_contracts_read" ON "skc_gov_contracts";
CREATE POLICY "gov_contracts_read" ON "skc_gov_contracts" FOR SELECT
  USING (
    student_id = auth.uid()::uuid
    OR job_id IN (SELECT id FROM "skc_jobs" WHERE employer_id = auth.uid()::uuid)
    OR auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "gov_contracts_write" ON "skc_gov_contracts";
CREATE POLICY "gov_contracts_write" ON "skc_gov_contracts" FOR ALL
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "gov_timesheets_read" ON "skc_gov_timesheets";
CREATE POLICY "gov_timesheets_read" ON "skc_gov_timesheets" FOR SELECT
  USING (
    student_id = auth.uid()::uuid
    OR verified_by = auth.uid()::uuid
    OR job_id IN (SELECT id FROM "skc_jobs" WHERE employer_id = auth.uid()::uuid)
    OR auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "gov_timesheets_write" ON "skc_gov_timesheets";
CREATE POLICY "gov_timesheets_write" ON "skc_gov_timesheets" FOR ALL
  USING (
    student_id = auth.uid()::uuid
    OR verified_by = auth.uid()::uuid
    OR auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "work_cert_read" ON "skc_work_certifications";
CREATE POLICY "work_cert_read" ON "skc_work_certifications" FOR SELECT
  USING (
    student_id = auth.uid()::uuid
    OR certified_by_employer = auth.uid()::uuid
    OR certified_by_mentor = auth.uid()::uuid
    OR auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "work_cert_write" ON "skc_work_certifications";
CREATE POLICY "work_cert_write" ON "skc_work_certifications" FOR ALL
  USING (
    certified_by_employer = auth.uid()::uuid
    OR certified_by_mentor = auth.uid()::uuid
    OR auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "disbursements_read" ON "skc_disbursements";
CREATE POLICY "disbursements_read" ON "skc_disbursements" FOR SELECT
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "disbursements_write" ON "skc_disbursements";
CREATE POLICY "disbursements_write" ON "skc_disbursements" FOR ALL
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "official_docs_read" ON "skc_official_documents";
CREATE POLICY "official_docs_read" ON "skc_official_documents" FOR SELECT
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
    OR job_id IN (SELECT id FROM "skc_jobs" WHERE student_id = auth.uid()::uuid OR employer_id = auth.uid()::uuid)
  );

DROP POLICY IF EXISTS "official_docs_write" ON "skc_official_documents";
CREATE POLICY "official_docs_write" ON "skc_official_documents" FOR ALL
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff')
    )
  );

DROP POLICY IF EXISTS "gov_workflow_log_read" ON "skc_gov_workflow_log";
CREATE POLICY "gov_workflow_log_read" ON "skc_gov_workflow_log" FOR SELECT
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM "skc_users" WHERE role IN ('admin', 'superadmin', 'rmutl_staff', 'project_staff', 'teacher')
    )
  );

DROP POLICY IF EXISTS "gov_workflow_log_insert" ON "skc_gov_workflow_log";
CREATE POLICY "gov_workflow_log_insert" ON "skc_gov_workflow_log" FOR INSERT
  WITH CHECK (true);  -- ระบบเขียนได้เสมอ (triggered by API)
