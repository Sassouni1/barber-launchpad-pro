-- Keep each Facebook login attempt independently valid for 30 minutes.
-- A callback atomically deletes its state before exchanging the OAuth code.
-- Lovable's Drizzle migration may have created this table already. Keep the
-- Supabase CLI migration safe when it is applied to the same project later.
CREATE TABLE IF NOT EXISTS public.ad_social_oauth_attempts (
  state uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_social_oauth_attempts_customer_id_idx
  ON public.ad_social_oauth_attempts (customer_id, created_at);

REVOKE ALL ON public.ad_social_oauth_attempts FROM anon, authenticated;
GRANT ALL ON public.ad_social_oauth_attempts TO service_role;
ALTER TABLE public.ad_social_oauth_attempts ENABLE ROW LEVEL SECURITY;
