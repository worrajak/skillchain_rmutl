-- ================================================================
-- Migration: skc_job_images table + employer quota columns
-- SkillChain RMUTL — รูปภาพงาน + ระบบโควต้าผู้ว่าจ้าง
-- ================================================================

-- 1) Employer Quota: เพิ่มคอลัมน์ในตาราง skc_users
ALTER TABLE skc_users ADD COLUMN IF NOT EXISTS job_quota INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skc_users ADD COLUMN IF NOT EXISTS job_quota_used INTEGER NOT NULL DEFAULT 0;

-- 2) Job Images: ตารางเก็บรูปภาพงาน (job/progress/completion)
CREATE TABLE IF NOT EXISTS skc_job_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES skc_jobs(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  image_type  TEXT NOT NULL DEFAULT 'job',  -- 'job' | 'progress' | 'completion'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES skc_users(id),
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_images_job ON skc_job_images(job_id);
CREATE INDEX IF NOT EXISTS idx_job_images_type ON skc_job_images(job_id, image_type);

-- 3) RLS Policies for skc_job_images
ALTER TABLE skc_job_images ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่ login อ่านรูปได้
CREATE POLICY "authenticated_read_job_images" ON skc_job_images
  FOR SELECT TO authenticated USING (true);

-- ผู้อัปโหลดเท่านั้นที่ insert ได้
CREATE POLICY "uploader_insert_job_images" ON skc_job_images
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- ผู้อัปโหลดหรือ staff/admin ลบได้
CREATE POLICY "uploader_or_staff_delete_job_images" ON skc_job_images
  FOR DELETE TO authenticated USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM skc_users
      WHERE skc_users.id = auth.uid()
      AND skc_users.role IN ('admin', 'superadmin', 'project_staff', 'rmutl_staff')
    )
  );

-- 4) Supabase Storage bucket (ต้องสร้างผ่าน Dashboard หรือ SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('job-images', 'job-images', true)
-- ON CONFLICT (id) DO NOTHING;
