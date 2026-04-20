CREATE POLICY "Admins create any listing"
ON public.specialist_directory
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));