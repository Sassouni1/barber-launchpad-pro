UPDATE public.website_templates
SET field_rules = '{
  "@#nikkole .sf-nikkole-grid": {"group": true},
  "@#philosophy .sf-content-narrow": {"group": true},
  "@#dedication .sf-content-narrow": {"group": true},
  "@#salvador-letter .sf-salvador-letter-copy": {"group": true, "groupExclude": ".sf-salvador-letter-signoff, .sf-salvador-letter-hashtag"}
}'::jsonb
WHERE template_key = 'stay-faded';