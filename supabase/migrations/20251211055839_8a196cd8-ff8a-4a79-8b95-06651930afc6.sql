
-- Create todos table for admin-managed course tasks
CREATE TABLE public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'course' CHECK (type IN ('course', 'daily', 'weekly')),
  week_number integer, -- For course todos (1-5)
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_todos table for tracking user completion
CREATE TABLE public.user_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  todo_id uuid REFERENCES public.todos(id) ON DELETE CASCADE NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, todo_id)
);

-- Enable RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_todos ENABLE ROW LEVEL SECURITY;

-- Todos policies (admin manages, everyone views)
CREATE POLICY "Anyone can view todos" ON public.todos FOR SELECT USING (true);
CREATE POLICY "Admins can insert todos" ON public.todos FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update todos" ON public.todos FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete todos" ON public.todos FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- User todos policies (users manage their own)
CREATE POLICY "Users can view own todo progress" ON public.user_todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todo progress" ON public.user_todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todo progress" ON public.user_todos FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
