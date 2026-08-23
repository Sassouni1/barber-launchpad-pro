DROP VIEW IF EXISTS public.published_sites;

CREATE VIEW public.published_sites
WITH (security_invoker = off) AS
SELECT
  w.site_slug,
  w.custom_domain,
  w.template_key,
  w.published_pages,
  w.published_at,
  t.asset_origin AS legacy_origin
FROM public.member_websites w
LEFT JOIN public.website_templates t ON t.template_key = w.template_key
WHERE w.deployment_status = ANY (ARRAY['published'::text, 'domain_pending'::text])
  AND w.published_at IS NOT NULL;

REVOKE ALL ON public.published_sites FROM PUBLIC;
GRANT SELECT ON public.published_sites TO anon, authenticated, service_role;

COMMENT ON VIEW public.published_sites IS
  'Public hosting contract: published page HTML only (no drafts, no owner ids). Read by the Cloudflare member-sites worker with the anon key.';

UPDATE public.website_templates
SET asset_origin = 'https://stay-faded-barbershop.pages.dev', updated_at = now()
WHERE template_key = 'stay-faded';