-- Idle Reminders Dedupe Table
-- ใช้สำหรับกัน /api/cron/idle-reminders ส่งซ้ำเรื่องเดียวกัน
--
-- หลัก: 1 (job_id, kind) ได้รับ ping ครั้งเดียวภายใน 12 ชม.
-- ถ้า kind = NULL (เช่น unsupervised reminder) → use job_id only
-- หลัง 12 ชม. สามารถ ping ซ้ำได้

CREATE TABLE IF NOT EXISTS skc_idle_reminders_sent (
  id        BIGSERIAL PRIMARY KEY,
  job_id    TEXT NOT NULL,
  kind      TEXT NOT NULL,
  -- pending_review, pending_apps, schedule_employer, schedule_student,
  -- submitted_staff, submitted_employer, unpaid_escrow, unsupervised
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idle_reminders_dedupe
  ON skc_idle_reminders_sent(job_id, kind, sent_at DESC);

COMMENT ON TABLE skc_idle_reminders_sent IS
  'Dedupe table for /api/cron/idle-reminders — entry (job_id, kind) within last 12h blocks re-send';
