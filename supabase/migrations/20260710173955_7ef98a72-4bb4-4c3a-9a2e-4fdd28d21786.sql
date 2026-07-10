ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP WITH TIME ZONE;
GRANT SELECT, UPDATE ON public.certifications TO authenticated;
GRANT ALL ON public.certifications TO service_role;