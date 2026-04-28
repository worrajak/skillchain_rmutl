-- ===========================================================
-- Allow multiple reviews per (job, reviewer, reviewee) pair —
-- one per eval_phase (PRE_WORK / IN_PROGRESS / POST_WORK).
-- Schema already has eval_phase column; only the unique
-- constraint needs widening.
-- ===========================================================

-- Employer reviews
ALTER TABLE skc_employer_reviews
  DROP CONSTRAINT IF EXISTS skc_employer_reviews_job_id_employer_id_student_id_key;

ALTER TABLE skc_employer_reviews
  ADD CONSTRAINT skc_employer_reviews_job_phase_unique
  UNIQUE (job_id, employer_id, student_id, eval_phase);

-- Student reviews
ALTER TABLE skc_student_reviews
  DROP CONSTRAINT IF EXISTS skc_student_reviews_job_id_student_id_employer_id_key;

ALTER TABLE skc_student_reviews
  ADD CONSTRAINT skc_student_reviews_job_phase_unique
  UNIQUE (job_id, student_id, employer_id, eval_phase);

-- Mentor reviews (if applicable — schema may not have eval_phase here)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skc_mentor_reviews' AND column_name = 'eval_phase'
  ) THEN
    ALTER TABLE skc_mentor_reviews
      DROP CONSTRAINT IF EXISTS skc_mentor_reviews_job_id_mentor_id_trainee_id_key;

    ALTER TABLE skc_mentor_reviews
      ADD CONSTRAINT skc_mentor_reviews_job_phase_unique
      UNIQUE (job_id, mentor_id, trainee_id, eval_phase);
  END IF;
END $$;
