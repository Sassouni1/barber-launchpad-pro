-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all quiz attempts
CREATE POLICY "Admins can view all quiz attempts"
ON public.user_quiz_attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all user progress
CREATE POLICY "Admins can view all user progress"
ON public.user_progress
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));