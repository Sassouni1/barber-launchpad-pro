
-- Recreate the sanitized view so it runs as its owner (bypassing RLS on the
-- base quiz_answers table, which is admin-only) and expose it to signed-in
-- members. The view intentionally excludes the is_correct column.
ALTER VIEW public.quiz_answer_options SET (security_invoker = false);

GRANT SELECT ON public.quiz_answer_options TO authenticated;
