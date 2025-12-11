-- Create storage bucket for course files
INSERT INTO storage.buckets (id, name, public) VALUES ('course-files', 'course-files', true);

-- Storage policies for course files
CREATE POLICY "Anyone can view course files"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-files');

CREATE POLICY "Admins can upload course files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'course-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete course files"
ON storage.objects FOR DELETE
USING (bucket_id = 'course-files' AND has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for homework submissions
INSERT INTO storage.buckets (id, name, public) VALUES ('homework-submissions', 'homework-submissions', false);

-- Storage policies for homework submissions
CREATE POLICY "Users can view own homework files"
ON storage.objects FOR SELECT
USING (bucket_id = 'homework-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own homework files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'homework-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Module downloadable files table
CREATE TABLE public.module_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.module_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view module files"
ON public.module_files FOR SELECT USING (true);

CREATE POLICY "Admins can insert module files"
ON public.module_files FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update module files"
ON public.module_files FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete module files"
ON public.module_files FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Quiz questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_image_url TEXT,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quiz questions"
ON public.quiz_questions FOR SELECT USING (true);

CREATE POLICY "Admins can insert quiz questions"
ON public.quiz_questions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update quiz questions"
ON public.quiz_questions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quiz questions"
ON public.quiz_questions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Quiz answers table
CREATE TABLE public.quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quiz answers"
ON public.quiz_answers FOR SELECT USING (true);

CREATE POLICY "Admins can insert quiz answers"
ON public.quiz_answers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update quiz answers"
ON public.quiz_answers FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quiz answers"
ON public.quiz_answers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- User quiz attempts table
CREATE TABLE public.user_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz attempts"
ON public.user_quiz_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz attempts"
ON public.user_quiz_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Homework submissions table
CREATE TABLE public.homework_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  text_response TEXT,
  checklist_completed BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own homework submissions"
ON public.homework_submissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own homework submissions"
ON public.homework_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own homework submissions"
ON public.homework_submissions FOR UPDATE
USING (auth.uid() = user_id);

-- Homework files table
CREATE TABLE public.homework_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.homework_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own homework files"
ON public.homework_files FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.homework_submissions hs 
  WHERE hs.id = homework_files.submission_id AND hs.user_id = auth.uid()
));

CREATE POLICY "Users can insert own homework files"
ON public.homework_files FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.homework_submissions hs 
  WHERE hs.id = homework_files.submission_id AND hs.user_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_quiz_questions_updated_at
BEFORE UPDATE ON public.quiz_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_homework_submissions_updated_at
BEFORE UPDATE ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();