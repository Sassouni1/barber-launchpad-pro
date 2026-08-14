CREATE TABLE public.ad_social_credentials (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  facebook_user_access_token text,
  facebook_user_token_expires_at timestamptz,
  facebook_page_access_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_social_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ad_social_credentials FROM anon, authenticated;
GRANT ALL ON TABLE public.ad_social_credentials TO service_role;

CREATE TRIGGER trg_ad_social_credentials_updated_at BEFORE UPDATE ON public.ad_social_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
