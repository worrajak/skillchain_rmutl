-- ============================================================
-- Telegram Integration for SkillChain
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add telegram_chat_id to skc_users
ALTER TABLE skc_users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_telegram ON skc_users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- 2. Create skc_telegram_link_tokens table (temporary tokens for linking)
CREATE TABLE IF NOT EXISTS skc_telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES skc_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_tokens_lookup ON skc_telegram_link_tokens(token, used);

-- 3. RLS for skc_telegram_link_tokens
ALTER TABLE skc_telegram_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tlt_insert_self" ON skc_telegram_link_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tlt_select_self" ON skc_telegram_link_tokens FOR SELECT
  USING (user_id = auth.uid());

-- Service role can read/update all (for webhook)
-- No additional policy needed — service role bypasses RLS

-- 4. Auto-cleanup expired tokens (optional — run periodically)
-- DELETE FROM skc_telegram_link_tokens WHERE expires_at < now() OR used = true;
