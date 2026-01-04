-- Create certificate_layouts table to store AI-detected coordinates
CREATE TABLE public.certificate_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL UNIQUE,
  template_path TEXT NOT NULL DEFAULT 'template/certificate-template.png',
  name_x INTEGER NOT NULL DEFAULT 0,
  name_y INTEGER NOT NULL DEFAULT 0,
  name_max_width INTEGER NOT NULL DEFAULT 800,
  name_font_size INTEGER NOT NULL DEFAULT 72,
  name_min_font_size INTEGER NOT NULL DEFAULT 48,
  name_color TEXT NOT NULL DEFAULT '#C9A227',
  date_x INTEGER NOT NULL DEFAULT 0,
  date_y INTEGER NOT NULL DEFAULT 0,
  date_font_size INTEGER NOT NULL DEFAULT 24,
  date_color TEXT NOT NULL DEFAULT '#C9A227',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificate_layouts ENABLE ROW LEVEL SECURITY;

-- Everyone can read layouts
CREATE POLICY "Anyone can view certificate layouts"
ON public.certificate_layouts
FOR SELECT
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert certificate layouts"
ON public.certificate_layouts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update certificate layouts"
ON public.certificate_layouts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete certificate layouts"
ON public.certificate_layouts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_certificate_layouts_updated_at
BEFORE UPDATE ON public.certificate_layouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();