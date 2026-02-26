-- Create storage bucket for poster templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('poster-templates', 'poster-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload poster templates
CREATE POLICY "Admins can upload poster templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poster-templates'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update poster templates
CREATE POLICY "Admins can update poster templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'poster-templates'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete poster templates
CREATE POLICY "Admins can delete poster templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'poster-templates'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow anyone to view poster templates (public bucket)
CREATE POLICY "Anyone can view poster templates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'poster-templates');

-- Seed the poster_template setting
INSERT INTO public.app_settings (key, value)
VALUES ('poster_template', '{"image_url": null, "qr_x": 50, "qr_y": 50, "qr_size": 15}')
ON CONFLICT (key) DO NOTHING;