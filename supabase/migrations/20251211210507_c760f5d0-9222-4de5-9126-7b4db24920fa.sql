-- Create dynamic_todo_lists table for list groupings
CREATE TABLE public.dynamic_todo_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dynamic_todo_items table for items within each list
CREATE TABLE public.dynamic_todo_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.dynamic_todo_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_dynamic_todo_progress table for tracking user completion
CREATE TABLE public.user_dynamic_todo_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.dynamic_todo_items(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Enable RLS on all tables
ALTER TABLE public.dynamic_todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dynamic_todo_progress ENABLE ROW LEVEL SECURITY;

-- Policies for dynamic_todo_lists (anyone can view, admins can manage)
CREATE POLICY "Anyone can view dynamic todo lists" ON public.dynamic_todo_lists FOR SELECT USING (true);
CREATE POLICY "Admins can insert dynamic todo lists" ON public.dynamic_todo_lists FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update dynamic todo lists" ON public.dynamic_todo_lists FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete dynamic todo lists" ON public.dynamic_todo_lists FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for dynamic_todo_items (anyone can view, admins can manage)
CREATE POLICY "Anyone can view dynamic todo items" ON public.dynamic_todo_items FOR SELECT USING (true);
CREATE POLICY "Admins can insert dynamic todo items" ON public.dynamic_todo_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update dynamic todo items" ON public.dynamic_todo_items FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete dynamic todo items" ON public.dynamic_todo_items FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for user_dynamic_todo_progress (users can manage their own progress)
CREATE POLICY "Users can view own dynamic todo progress" ON public.user_dynamic_todo_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dynamic todo progress" ON public.user_dynamic_todo_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dynamic todo progress" ON public.user_dynamic_todo_progress FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at on dynamic_todo_lists
CREATE TRIGGER update_dynamic_todo_lists_updated_at
BEFORE UPDATE ON public.dynamic_todo_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();