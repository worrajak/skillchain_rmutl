-- ============================================================================
-- Storage bucket for generated DOCX files (gov workflow)
-- ============================================================================
-- The /api/gov/.../generate-doc routes upload to bucket 'official-documents'.
-- This bucket may not exist after a DB reset. Without it, generation falls
-- back to direct download (no permanent record). Run this migration to
-- enable persistent storage.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'official-documents',
  'official-documents',
  true,                                              -- public read for downloads
  52428800,                                          -- 50 MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/msword'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies for storage.objects in this bucket
DROP POLICY IF EXISTS "official_docs_storage_read" ON storage.objects;
CREATE POLICY "official_docs_storage_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'official-documents');

DROP POLICY IF EXISTS "official_docs_storage_upload" ON storage.objects;
CREATE POLICY "official_docs_storage_upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'official-documents');

DROP POLICY IF EXISTS "official_docs_storage_update" ON storage.objects;
CREATE POLICY "official_docs_storage_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'official-documents')
  WITH CHECK (bucket_id = 'official-documents');

DROP POLICY IF EXISTS "official_docs_storage_delete" ON storage.objects;
CREATE POLICY "official_docs_storage_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'official-documents'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM skc_users
        WHERE id = auth.uid()::text AND role IN ('admin', 'superadmin')
      )
    )
  );

-- Verify
SELECT 'Bucket created' AS info, COUNT(*) AS count FROM storage.buckets WHERE id = 'official-documents'
UNION ALL
SELECT 'Storage policies', COUNT(*)
  FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid
  WHERE c.relname = 'objects' AND polname LIKE 'official_docs_storage_%';
