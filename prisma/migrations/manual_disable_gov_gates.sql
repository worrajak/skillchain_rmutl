-- ============================================================================
-- PILOT MODE: Disable gov-workflow DB gates
-- ============================================================================
-- The triggers fn_job_gate_check_assignment / fn_job_gate_check_escrow_release
-- block status transitions until gov_status reaches ACTIVITY_APPROVED /
-- DISBURSEMENT_APPROVED. This is correct for production but blocks pilot
-- testing where the gov paperwork flow isn't fully wired yet.
--
-- This migration neutralizes the gate functions to no-ops while keeping the
-- trigger wiring + workflow log intact. To re-enable enforcement later,
-- restore the function bodies from manual_fix_job_trigger.sql.
-- ============================================================================

-- Assignment gate → no-op
CREATE OR REPLACE FUNCTION fn_job_gate_check_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- PILOT MODE: gate disabled. To re-enable, restore from manual_fix_job_trigger.sql
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Escrow release gate → no-op
CREATE OR REPLACE FUNCTION fn_job_gate_check_escrow_release()
RETURNS TRIGGER AS $$
BEGIN
  -- PILOT MODE: gate disabled. To re-enable, restore from manual_fix_job_trigger.sql
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT
  proname AS function_name,
  CASE WHEN prosrc LIKE '%PILOT MODE%' THEN '✅ disabled' ELSE '⚠️ still enforcing' END AS state
FROM pg_proc
WHERE proname IN ('fn_job_gate_check_assignment', 'fn_job_gate_check_escrow_release');
