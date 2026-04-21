ALTER TABLE public.certificate_layouts
ADD COLUMN IF NOT EXISTS date_font_family text NOT NULL DEFAULT 'name';

UPDATE public.certificate_layouts
SET date_color = name_color
WHERE date_color = '#FFFFFF' OR date_color = '#ffffff';