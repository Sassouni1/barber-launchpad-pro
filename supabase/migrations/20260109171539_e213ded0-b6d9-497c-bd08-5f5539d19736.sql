-- Drop the view and recreate with SECURITY INVOKER (default, but explicit)
DROP VIEW IF EXISTS public.quiz_answer_options;

CREATE VIEW public.quiz_answer_options 
WITH (security_invoker = true) AS
SELECT id, question_id, answer_text, order_index, created_at
FROM public.quiz_answers;

-- Grant access to authenticated users
GRANT SELECT ON public.quiz_answer_options TO authenticated;
GRANT SELECT ON public.quiz_answer_options TO anon;