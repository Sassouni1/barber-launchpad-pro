-- Create subtasks table
CREATE TABLE public.todo_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.todo_subtasks ENABLE ROW LEVEL SECURITY;

-- Admins can manage subtasks
CREATE POLICY "Admins can insert subtasks" 
ON public.todo_subtasks 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update subtasks" 
ON public.todo_subtasks 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete subtasks" 
ON public.todo_subtasks 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view subtasks" 
ON public.todo_subtasks 
FOR SELECT 
USING (true);

-- Track user completion of subtasks
CREATE TABLE public.user_subtask_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subtask_id UUID NOT NULL REFERENCES public.todo_subtasks(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subtask_id)
);

-- Enable RLS
ALTER TABLE public.user_subtask_progress ENABLE ROW LEVEL SECURITY;

-- Users can manage their own progress
CREATE POLICY "Users can view own subtask progress" 
ON public.user_subtask_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subtask progress" 
ON public.user_subtask_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subtask progress" 
ON public.user_subtask_progress 
FOR UPDATE 
USING (auth.uid() = user_id);