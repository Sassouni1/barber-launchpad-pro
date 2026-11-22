DROP POLICY IF EXISTS "Anyone can view todos" ON public.todos;
CREATE POLICY "Members can view todos" ON public.todos FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view subtasks" ON public.todo_subtasks;
CREATE POLICY "Members can view subtasks" ON public.todo_subtasks FOR SELECT TO authenticated USING (public.member_content_allowed());