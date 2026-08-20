
CREATE TABLE public.member_websites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_slug TEXT NOT NULL,
  custom_domain TEXT,
  live_url TEXT,
  cloudflare_registration_status TEXT NOT NULL DEFAULT 'none',
  cloudflare_attachment_status TEXT NOT NULL DEFAULT 'none',
  cloudflare_last_error TEXT,
  home_document JSONB NOT NULL DEFAULT '{}'::jsonb,
  hair_system_document JSONB NOT NULL DEFAULT '{}'::jsonb,
  home_html TEXT,
  hair_system_html TEXT,
  deployment_status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_websites_user_unique UNIQUE (user_id),
  CONSTRAINT member_websites_slug_unique UNIQUE (site_slug),
  CONSTRAINT member_websites_domain_unique UNIQUE (custom_domain),
  CONSTRAINT member_websites_slug_format CHECK (site_slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  CONSTRAINT member_websites_deployment_status CHECK (deployment_status IN ('draft','publishing','published','failed'))
);

CREATE INDEX idx_member_websites_published ON public.member_websites (site_slug) WHERE deployment_status = 'published';
CREATE INDEX idx_member_websites_custom_domain ON public.member_websites (custom_domain) WHERE custom_domain IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.member_websites TO authenticated;
GRANT ALL ON public.member_websites TO service_role;
GRANT SELECT (site_slug, custom_domain, home_html, hair_system_html, published_at, deployment_status)
  ON public.member_websites TO anon;

ALTER TABLE public.member_websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their own website"
  ON public.member_websites FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Published websites are publicly readable"
  ON public.member_websites FOR SELECT
  TO anon
  USING (deployment_status = 'published');

CREATE OR REPLACE FUNCTION public.set_member_websites_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_member_websites_updated_at
  BEFORE UPDATE ON public.member_websites
  FOR EACH ROW EXECUTE FUNCTION public.set_member_websites_updated_at();

CREATE VIEW public.published_sites
WITH (security_invoker = true) AS
SELECT site_slug, custom_domain, home_html, hair_system_html, published_at
FROM public.member_websites
WHERE deployment_status = 'published';

GRANT SELECT ON public.published_sites TO anon, authenticated;

CREATE POLICY "Website assets are readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'website-assets');

CREATE POLICY "Members upload their own website assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'website-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Members update their own website assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'website-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'website-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Members delete their own website assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'website-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
