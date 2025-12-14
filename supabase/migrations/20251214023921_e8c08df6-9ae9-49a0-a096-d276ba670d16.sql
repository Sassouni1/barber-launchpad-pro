-- Allow admins to view all dynamic todo progress
CREATE POLICY "Admins can view all dynamic todo progress"
ON public.user_dynamic_todo_progress
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));