-- Add avatar_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add encrypted wallet private key column (for auto-generated wallets)
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_private_key TEXT;

-- Recreate student_rating_summary view with avatar_url
-- DROP first because CREATE OR REPLACE cannot add new columns
DROP VIEW IF EXISTS student_rating_summary;
CREATE VIEW student_rating_summary AS
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
FROM users u
LEFT JOIN LATERAL (
  SELECT credential_level
  FROM student_credentials sc2
  WHERE sc2.student_id = u.id AND sc2.is_active = true
  ORDER BY sc2.credential_level DESC
  LIMIT 1
) sc ON true
LEFT JOIN LATERAL (
  SELECT AVG(weighted_score) AS avg_score, COUNT(*) AS cnt
  FROM evaluations ev WHERE ev.student_id = u.id
) t ON true
LEFT JOIN LATERAL (
  SELECT AVG(overall_rating) AS avg_rating, COUNT(*) AS cnt
  FROM employer_reviews er WHERE er.student_id = u.id
) e ON true
LEFT JOIN LATERAL (
  SELECT AVG(weighted_score) AS avg_score, COUNT(*) AS cnt
  FROM mentor_reviews mr WHERE mr.trainee_id = u.id
) m ON true
WHERE u.role = 'student';
