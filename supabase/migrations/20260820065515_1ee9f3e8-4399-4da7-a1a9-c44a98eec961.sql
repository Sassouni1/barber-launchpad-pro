CREATE TABLE public.password_reset_short_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.password_reset_short_links TO service_role;

ALTER TABLE public.password_reset_short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.password_reset_short_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_prsl_active ON public.password_reset_short_links (code_hash)
  WHERE used_at IS NULL;
CREATE INDEX idx_prsl_expires ON public.password_reset_short_links (expires_at)
  WHERE used_at IS NULL;