ALTER TABLE public.website_templates
  ADD COLUMN IF NOT EXISTS repeat_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.website_templates
SET repeat_rules = '[
  {"key":"services","label":"service","container":".sf-service-grid","item":".sf-service-card","max":12},
  {"key":"rates","label":"rate","container":".sf-rate-grid","item":".sf-rate-card","max":40}
]'::jsonb,
    updated_at = now()
WHERE template_key = 'stay-faded';