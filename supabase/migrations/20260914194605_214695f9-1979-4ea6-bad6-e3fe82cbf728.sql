UPDATE public.website_templates
SET repeat_rules = (
  COALESCE(repeat_rules, '[]'::jsonb) - 'gallery'
) || jsonb_build_array(
  jsonb_build_object(
    'key', 'gallery',
    'label', 'photo',
    'container', '.sf-photo-gallery-grid',
    'item', '.sf-photo-gallery-card',
    'max', 24,
    'gallery', true,
    'shareAnchor', 'inside-stay-faded',
    'dropClasses', jsonb_build_array('sf-photo-owner', 'sf-photo-location')
  )
),
updated_at = now()
WHERE template_key = 'stay-faded'
  AND NOT (COALESCE(repeat_rules, '[]'::jsonb) @> '[{"key":"gallery"}]'::jsonb);