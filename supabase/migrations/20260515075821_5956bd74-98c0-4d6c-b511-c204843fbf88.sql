
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS lesson_id uuid;
ALTER TABLE public.quiz_questions ALTER COLUMN module_id DROP NOT NULL;

ALTER TABLE public.user_quiz_attempts ADD COLUMN IF NOT EXISTS lesson_id uuid;
ALTER TABLE public.user_quiz_attempts ALTER COLUMN module_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson_id ON public.quiz_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_attempts_lesson_id ON public.user_quiz_attempts(lesson_id);

CREATE OR REPLACE FUNCTION public.validate_quiz_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.module_id IS NULL AND NEW.lesson_id IS NULL)
     OR (NEW.module_id IS NOT NULL AND NEW.lesson_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of module_id or lesson_id must be set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_questions_owner_check ON public.quiz_questions;
CREATE TRIGGER quiz_questions_owner_check
  BEFORE INSERT OR UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.validate_quiz_owner();

DROP TRIGGER IF EXISTS user_quiz_attempts_owner_check ON public.user_quiz_attempts;
CREATE TRIGGER user_quiz_attempts_owner_check
  BEFORE INSERT OR UPDATE ON public.user_quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.validate_quiz_owner();
