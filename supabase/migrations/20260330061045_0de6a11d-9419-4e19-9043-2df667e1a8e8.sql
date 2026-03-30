
ALTER TABLE public.certification_photos 
  ADD COLUMN approved boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_at timestamp with time zone;

CREATE POLICY "Admins can update certification photos"
  ON public.certification_photos
  FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
