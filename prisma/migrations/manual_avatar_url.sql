-- Add avatar_url column to skc_users table
ALTER TABLE skc_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add encrypted wallet private key column (for auto-generated wallets)
ALTER TABLE skc_users ADD COLUMN IF NOT EXISTS wallet_private_key TEXT;

-- Recreate skc_student_rating_summary view with avatar_url
-- DROP first because CREATE OR REPLACE cannot add new columns
DROP VIEW IF EXISTS skc_student_rating_summary;
CREATE VIEW skc_student_rating_summary AS
SELECT
  u.id AS student_id,
  u.name,
  u.campus,
  u.avatar_url,
  COALESCE(sc.credential_level, 'LEVEL_1') AS credential_level,
  COALESCE(t.avg_score, 0) AS avg_teacher_score,
  COALESCE(t.cnt, 0) AS teacher_review_count,
  COALESCE(e.avg_rating, 0) AS avg_employer_rating,
  COALESCE(e.cnt, 0) AS employer_review_count,
  COALESCE(m.avg_score, 0) AS avg_mentor_score,
  COALESCE(m.cnt, 0) AS mentor_review_count,
  ROUND(
    (COALESCE(t.avg_score, 0) * 0.4 + COALESCE(e.avg_rating, 0) * 0.4 + COALESCE(m.avg_score, 0) * 0.2)::numeric,
    2
  ) AS combined_score
FROM skc_users u
LEFT JOIN LATERAL (
  SELECT credential_level
  FROM skc_student_credentials sc2
  WHERE sc2.student_id = u.id AND sc2.is_active = true
  ORDER BY sc2.credential_level DESC
  LIMIT 1
) sc ON true
LEFT JOIN LATERAL (
  SELECT AVG(weighted_score) AS avg_score, COUNT(*) AS cnt
  FROM skc_evaluations ev WHERE ev.student_id = u.id
) t ON true
LEFT JOIN LATERAL (
  SELECT AVG(overall_rating) AS avg_rating, COUNT(*) AS cnt
  FROM skc_employer_reviews er WHERE er.student_id = u.id
) e ON true
LEFT JOIN LATERAL (
  SELECT AVG(weighted_score) AS avg_score, COUNT(*) AS cnt
  FROM skc_mentor_reviews mr WHERE mr.trainee_id = u.id
) m ON true
WHERE u.role = 'student';
