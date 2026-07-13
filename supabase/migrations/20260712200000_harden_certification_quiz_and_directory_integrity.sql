-- Keep certification issuance and destructive resets behind the service-role
-- edge functions. Members may only record that they downloaded a certificate.
DROP POLICY IF EXISTS "Users can insert own certifications" ON public.certifications;
DROP POLICY IF EXISTS "Users can update own certifications" ON public.certifications;

REVOKE INSERT, UPDATE, DELETE ON public.certifications FROM authenticated;
GRANT UPDATE (downloaded_at) ON public.certifications TO authenticated;

CREATE POLICY "Users can mark own certificate downloaded"
ON public.certifications
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- The learner-facing view intentionally omits is_correct. The base table is
-- admin/service-role only so the answer key cannot be read through REST.
DROP POLICY IF EXISTS "Anyone can view quiz answers" ON public.quiz_answers;
CREATE POLICY "Admins can view all quiz answers"
ON public.quiz_answers
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP VIEW IF EXISTS public.quiz_answer_options;
CREATE VIEW public.quiz_answer_options
WITH (security_invoker = false) AS
SELECT id, question_id, answer_text, order_index, created_at
FROM public.quiz_answers;

GRANT SELECT ON public.quiz_answer_options TO anon, authenticated;

-- Attempts are written by verify-quiz with the service role after validating
-- the submitted answers. Direct client inserts would let users fabricate 100%
-- attempts and unlock certification.
DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON public.user_quiz_attempts;
REVOKE INSERT, UPDATE, DELETE ON public.user_quiz_attempts FROM authenticated;

-- Members can edit their profile fields, but approval and visibility are
-- controlled by an admin. This trigger is defense in depth because the client
-- previously submitted approved=true/visible=true directly.
CREATE OR REPLACE FUNCTION public.protect_specialist_directory_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.approved := false;
      NEW.approved_at := NULL;
      NEW.visible := false;
    ELSE
      NEW.approved := OLD.approved;
      NEW.approved_at := OLD.approved_at;
      NEW.visible := OLD.visible;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_specialist_directory_approval ON public.specialist_directory;
CREATE TRIGGER protect_specialist_directory_approval
BEFORE INSERT OR UPDATE ON public.specialist_directory
FOR EACH ROW
EXECUTE FUNCTION public.protect_specialist_directory_approval();
