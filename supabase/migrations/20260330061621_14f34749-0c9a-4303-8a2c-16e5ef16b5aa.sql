
CREATE POLICY "Admins can view all certification photos in storage"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'certification-photos'
    AND has_role(auth.uid(), 'admin'::app_role)
  );
