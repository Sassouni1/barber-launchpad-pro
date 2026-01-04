-- Create certification_photos table for user-submitted work photos
CREATE TABLE public.certification_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create certifications table for issued certificates
CREATE TABLE public.certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_name TEXT NOT NULL,
  certificate_url TEXT,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS on both tables
ALTER TABLE public.certification_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for certification_photos
CREATE POLICY "Users can view own certification photos"
ON public.certification_photos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certification photos"
ON public.certification_photos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own certification photos"
ON public.certification_photos
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all certification photos"
ON public.certification_photos
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for certifications
CREATE POLICY "Users can view own certifications"
ON public.certifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certifications"
ON public.certifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all certifications"
ON public.certifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for certification photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('certification-photos', 'certification-photos', false);

-- Create storage bucket for generated certificates (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true);

-- Storage policies for certification-photos bucket
CREATE POLICY "Users can upload their own certification photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'certification-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own certification photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certification-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own certification photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'certification-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for certificates bucket (public read, service role write)
CREATE POLICY "Anyone can view certificates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certificates');

CREATE POLICY "Service role can manage certificates"
ON storage.objects
FOR ALL
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');