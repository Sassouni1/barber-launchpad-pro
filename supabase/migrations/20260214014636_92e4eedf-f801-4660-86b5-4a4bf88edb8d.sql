
-- Create storage bucket for marketing images
INSERT INTO storage.buckets (id, name, public) VALUES ('marketing-images', 'marketing-images', true);

-- Allow anyone to read marketing images (public bucket)
CREATE POLICY "Public read marketing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-images');

-- Authenticated users can upload marketing images
CREATE POLICY "Authenticated users can upload marketing images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketing-images' AND auth.uid() IS NOT NULL);

-- Users can delete their own marketing images (folder = user_id)
CREATE POLICY "Users can delete own marketing images"
ON storage.objects FOR DELETE
USING (bucket_id = 'marketing-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create table to track marketing image metadata
CREATE TABLE public.marketing_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  variation_type TEXT NOT NULL,
  caption TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own marketing images"
ON public.marketing_images FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own marketing images"
ON public.marketing_images FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own marketing images"
ON public.marketing_images FOR DELETE
USING (auth.uid() = user_id);

-- Create cleanup function for images older than 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_old_marketing_images()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, storage_path FROM public.marketing_images
    WHERE created_at < now() - interval '24 hours'
  LOOP
    DELETE FROM storage.objects WHERE bucket_id = 'marketing-images' AND name = rec.storage_path;
    DELETE FROM public.marketing_images WHERE id = rec.id;
  END LOOP;
END;
$$;
