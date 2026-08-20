ALTER TABLE public.member_websites
  ADD COLUMN IF NOT EXISTS cloudflare_worker_domain_id TEXT;

DROP POLICY IF EXISTS "Published websites are publicly readable" ON public.member_websites;
CREATE POLICY "Published websites are publicly readable"
ON public.member_websites
FOR SELECT
TO anon
USING (deployment_status IN ('published','domain_pending') AND published_at IS NOT NULL);

CREATE OR REPLACE VIEW public.published_sites
WITH (security_invoker = true) AS
SELECT site_slug, custom_domain, home_html, hair_system_html, published_at
FROM public.member_websites
WHERE deployment_status IN ('published','domain_pending')
  AND published_at IS NOT NULL;

GRANT SELECT ON public.published_sites TO anon, authenticated;