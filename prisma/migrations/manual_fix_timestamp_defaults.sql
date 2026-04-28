-- ============================================================================
-- FIX: Add NOW() defaults to created_at + updated_at on all skc_* tables
-- ============================================================================
-- Issue: Prisma @default(now()) and @updatedAt set timestamps via Prisma
-- client. Supabase client doesn't use Prisma → NULL → constraint violation.
--
-- Solution: Set DB-level defaults so any client (Supabase, raw SQL, etc.)
-- gets correct timestamps automatically.
-- ============================================================================

-- Helper: set both created_at + updated_at defaults to NOW()
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'skc_%'
  LOOP
    -- Set created_at default if column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'created_at'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at SET DEFAULT NOW()', t);
    END IF;

    -- Set updated_at default if column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN updated_at SET DEFAULT NOW()', t);
    END IF;
  END LOOP;
END $$;

-- Auto-update trigger for updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to every skc_* table that has updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name LIKE 'skc_%'
      AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t);
  END LOOP;
END $$;

-- Verify
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'skc_%'
  AND column_name IN ('created_at', 'updated_at')
ORDER BY table_name, column_name;
