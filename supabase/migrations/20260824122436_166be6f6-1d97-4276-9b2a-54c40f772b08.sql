UPDATE public.website_templates
SET field_rules = '{
  "@#nikkole .sf-nikkole-grid": {"group": true, "groupExclude": "p:last-child"},
  "@#philosophy .sf-content-narrow": {"group": true},
  "@#dedication .sf-content-narrow": {"group": true, "groupExclude": "p:last-child"},
  "@#salvador-letter .sf-salvador-letter-copy": {"group": true, "groupExclude": ".sf-salvador-letter-signoff, .sf-salvador-letter-hashtag"}
}'::jsonb
WHERE template_key = 'stay-faded';