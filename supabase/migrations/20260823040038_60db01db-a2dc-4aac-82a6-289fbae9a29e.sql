UPDATE public.website_templates
SET pages = jsonb_build_array(
  jsonb_build_object('key','home','label','Home','path','/','source','/stay-faded/home.html','stylesheet','/stay-faded/home.css'),
  jsonb_build_object('key','hair-systems','label','Hair Systems','path','/stay-faded-hair-systems','source','/stay-faded/hair-systems.html','stylesheet','/stay-faded/hair-systems.css')
),
updated_at = now()
WHERE template_key = 'stay-faded';