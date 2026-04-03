-- ==========================================
-- SkillChain — Job Lifecycle Enhancement
-- Run this in Supabase SQL Editor
-- ==========================================

-- Work schedule dates
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_start_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_end_date DATE;

-- Dual confirmation for completion
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS staff_confirmed_completion BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer_confirmed_completion BOOLEAN NOT NULL DEFAULT false;

-- Schedule proposal tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_proposed_by UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_confirmed BOOLEAN NOT NULL DEFAULT false;
