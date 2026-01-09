-- Create a secure view that excludes the is_correct column
-- This prevents users from seeing which answers are correct before submitting
CREATE VIEW public.quiz_answer_options AS
SELECT id, question_id, answer_text, order_index, created_at
FROM public.quiz_answers;

-- Grant access to authenticated users
GRANT SELECT ON public.quiz_answer_options TO authenticated;
GRANT SELECT ON public.quiz_answer_options TO anon;