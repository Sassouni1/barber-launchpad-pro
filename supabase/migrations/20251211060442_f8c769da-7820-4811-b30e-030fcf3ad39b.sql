-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view todos" ON public.todos;
DROP POLICY IF EXISTS "Admins can insert todos" ON public.todos;
DROP POLICY IF EXISTS "Admins can update todos" ON public.todos;
DROP POLICY IF EXISTS "Admins can delete todos" ON public.todos;

-- Recreate as permissive policies
CREATE POLICY "Anyone can view todos" 
ON public.todos 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert todos" 
ON public.todos 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update todos" 
ON public.todos 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete todos" 
ON public.todos 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));