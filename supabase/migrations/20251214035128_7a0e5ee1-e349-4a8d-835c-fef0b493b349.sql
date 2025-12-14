-- Create table to track individual quiz responses
CREATE TABLE public.user_quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES user_quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_answer_id uuid NOT NULL REFERENCES quiz_answers(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_quiz_responses ENABLE ROW LEVEL SECURITY;

-- Users can insert their own responses (via their attempt)
CREATE POLICY "Users can insert own quiz responses" ON public.user_quiz_responses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_quiz_attempts WHERE id = attempt_id AND user_id = auth.uid())
  );

-- Users can view their own responses
CREATE POLICY "Users can view own quiz responses" ON public.user_quiz_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_quiz_attempts WHERE id = attempt_id AND user_id = auth.uid())
  );

-- Admins can view all responses
CREATE POLICY "Admins can view all quiz responses" ON public.user_quiz_responses
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));