CREATE TABLE public.ad_social_tokens (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'facebook',
  user_access_token text,
  user_token_expires_at timestamptz,
  page_access_token text,
  facebook_page_id text,
  scopes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.ad_social_tokens FROM anon, authenticated;
GRANT ALL ON public.ad_social_tokens TO service_role;

ALTER TABLE public.ad_social_tokens ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_ad_social_tokens_updated_at
BEFORE UPDATE ON public.ad_social_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();