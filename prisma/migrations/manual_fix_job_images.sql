-- ============================================================================
-- FIX: skc_job_images table + Storage bucket + RLS
-- ============================================================================
-- Issues:
-- 1. Table may not exist (migration didn't run)
-- 2. Type mismatch: uploaded_by UUID vs skc_users.id TEXT
-- 3. RLS policies need auth.uid()::text comparison
-- 4. Storage bucket "job-images" must exist
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop + recreate skc_job_images with correct types
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS "skc_job_images" CASCADE;

CREATE TABLE "skc_job_images" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id      TEXT NOT NULL REFERENCES "skc_jobs"(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  image_type  TEXT NOT NULL DEFAULT 'job',         -- 'job' | 'progress' | 'completion'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL REFERENCES "skc_users"(id),
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_images_job ON "skc_job_images"(job_id);
CREATE INDEX idx_job_images_type ON "skc_job_images"(job_id, image_type);

-- ----------------------------------------------------------------------------
-- 2. RLS Policies
-- ----------------------------------------------------------------------------

ALTER TABLE "skc_job_images" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_images_read" ON "skc_job_images";
CREATE POLICY "job_images_read" ON "skc_job_images" FOR SELECT
  USING (true);  -- ทุกคนอ่านได้

DROP POLICY IF EXISTS "job_images_insert" ON "skc_job_images";
CREATE POLICY "job_images_insert" ON "skc_job_images" FOR INSERT
  WITH CHECK (
    -- Auth user must match uploaded_by
    uploaded_by = auth.uid()::text
  );

DROP POLICY IF EXISTS "job_images_delete" ON "skc_job_images";
CREATE POLICY "job_images_delete" ON "skc_job_images" FOR DELETE
  USING (
    uploaded_by = auth.uid()::text
    OR public.is_admin_role()
  );

-- ----------------------------------------------------------------------------
-- 3. Create Storage bucket (idempotent)
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-images',
  'job-images',
  true,                                              -- public read
  10485760,                                          -- 10 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 4. Storage RLS — allow authenticated upload, public read
-- ----------------------------------------------------------------------------

-- Public can read (since bucket is public)
DROP POLICY IF EXISTS "job_images_storage_read" ON storage.objects;
CREATE POLICY "job_images_storage_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'job-images');

-- Authenticated can upload to job-images bucket
DROP POLICY IF EXISTS "job_images_storage_upload" ON storage.objects;
CREATE POLICY "job_images_storage_upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-images');

-- Authenticated can update own uploads
DROP POLICY IF EXISTS "job_images_storage_update" ON storage.objects;
CREATE POLICY "job_images_storage_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'job-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'job-images');

-- Authenticated can delete own uploads (or admin)
DROP POLICY IF EXISTS "job_images_storage_delete" ON storage.objects;
CREATE POLICY "job_images_storage_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-images'
    AND (owner = auth.uid() OR public.is_admin_role())
  );

-- ----------------------------------------------------------------------------
-- 5. Verify
-- ----------------------------------------------------------------------------

SELECT 'Table created' AS info, COUNT(*) AS row_count FROM "skc_job_images"
UNION ALL
SELECT 'Bucket created', COUNT(*) FROM storage.buckets WHERE id = 'job-images'
UNION ALL
SELECT 'Policies on table',
  (SELECT COUNT(*) FROM pg_policy WHERE polrelid = 'public.skc_job_images'::regclass)
UNION ALL
SELECT 'Storage policies',
  (SELECT COUNT(*) FROM pg_policy p
   JOIN pg_class c ON p.polrelid = c.oid
   WHERE c.relname = 'objects'
     AND polname LIKE 'job_images_storage_%');
