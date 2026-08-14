ALTER TABLE public.ad_social_tokens
  ADD COLUMN IF NOT EXISTS oauth_state text,
  ADD COLUMN IF NOT EXISTS oauth_state_created_at timestamptz;