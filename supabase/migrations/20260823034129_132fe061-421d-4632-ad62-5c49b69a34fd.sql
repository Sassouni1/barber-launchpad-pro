CREATE TABLE IF NOT EXISTS public.website_templates (
  template_key text PRIMARY KEY,
  display_name text NOT NULL,
  asset_origin text,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.website_templates TO authenticated;
GRANT ALL ON public.website_templates TO service_role;

ALTER TABLE public.website_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in members can read website template config" ON public.website_templates;
CREATE POLICY "Signed-in members can read website template config"
ON public.website_templates
FOR SELECT
TO authenticated
USING (true);

DROP TRIGGER IF EXISTS update_website_templates_updated_at ON public.website_templates;
CREATE TRIGGER update_website_templates_updated_at
BEFORE UPDATE ON public.website_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.website_editor_entitlements
  ADD COLUMN IF NOT EXISTS custom_domain text;

ALTER TABLE public.member_websites
  ADD COLUMN IF NOT EXISTS published_pages jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS template_key text;

INSERT INTO public.website_templates (template_key, display_name, asset_origin, pages, field_rules)
VALUES (
  'stay-faded',
  'Stay Faded Barbershop',
  'https://stayfadedbarbershop5280.com',
  '[
    {"key":"home","label":"Home","source":"/stay-faded/home.html","stylesheet":"/stay-faded/home.css","path":"/"},
    {"key":"hair-systems","label":"Hair Systems","source":"/stay-faded/hair-systems.html","stylesheet":"/stay-faded/hair-systems.css","path":"/hair-systems"}
  ]'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (template_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    asset_origin = EXCLUDED.asset_origin,
    pages = EXCLUDED.pages,
    updated_at = now();

UPDATE public.website_editor_entitlements
SET custom_domain = 'stayfadedbarbershop5280.com'
WHERE template_key = 'stay-faded' AND custom_domain IS DISTINCT FROM 'stayfadedbarbershop5280.com';

DROP VIEW IF EXISTS public.published_sites;
CREATE VIEW public.published_sites AS
SELECT site_slug,
       custom_domain,
       template_key,
       home_html,
       hair_system_html,
       published_pages,
       published_at
FROM public.member_websites
WHERE deployment_status = ANY (ARRAY['published'::text, 'domain_pending'::text])
  AND published_at IS NOT NULL;