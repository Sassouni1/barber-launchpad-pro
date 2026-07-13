
-- 1) Certificates storage bucket: lock writes to service_role only. Keep public read.
DROP POLICY IF EXISTS "Service role can manage certificates" ON storage.objects;
CREATE POLICY "Service role can manage certificates"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');

-- 2) marketing-images: enforce folder ownership on INSERT (matches DELETE policy).
DROP POLICY IF EXISTS "Authenticated users can upload marketing images" ON storage.objects;
CREATE POLICY "Authenticated users can upload marketing images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'marketing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) quiz_answers: do NOT expose is_correct to members. Restrict raw table SELECT to admins.
--    Members already read the sanitized public.quiz_answer_options view (no is_correct).
DROP POLICY IF EXISTS "Anyone can view quiz answers" ON public.quiz_answers;
CREATE POLICY "Admins can view quiz answers"
ON public.quiz_answers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4) certifications: block members from forging their own certification rows.
--    generate-certificate edge function uses service_role and bypasses RLS.
DROP POLICY IF EXISTS "Users can insert own certifications" ON public.certifications;

-- 5) specialist_directory: prevent self-approval / self-publish.
CREATE OR REPLACE FUNCTION public.enforce_specialist_directory_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF NOT is_admin THEN
    IF TG_OP = 'INSERT' THEN
      NEW.approved := false;
      NEW.visible  := false;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Non-admin cannot change moderation state
      NEW.approved := OLD.approved;
      NEW.visible  := OLD.visible;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_specialist_directory_moderation_trg ON public.specialist_directory;
CREATE TRIGGER enforce_specialist_directory_moderation_trg
BEFORE INSERT OR UPDATE ON public.specialist_directory
FOR EACH ROW EXECUTE FUNCTION public.enforce_specialist_directory_moderation();
