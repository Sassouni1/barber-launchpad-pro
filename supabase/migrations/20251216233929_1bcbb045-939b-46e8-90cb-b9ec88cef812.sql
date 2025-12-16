-- Add module_id column to dynamic_todo_items for linking to lessons
ALTER TABLE public.dynamic_todo_items 
ADD COLUMN module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL;