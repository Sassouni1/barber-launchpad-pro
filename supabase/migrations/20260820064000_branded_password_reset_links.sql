CREATE TABLE public.password_reset_short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_short_links ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.password_reset_short_links TO service_role;

CREATE INDEX idx_password_reset_short_links_expiry
  ON public.password_reset_short_links (expires_at)
  WHERE used_at IS NULL;
