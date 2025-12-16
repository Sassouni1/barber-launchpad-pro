-- Add module_id column to todos table for daily/weekly task lesson linking
ALTER TABLE public.todos 
ADD COLUMN module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL;

-- Add module_id column to todo_subtasks table for subtask lesson linking
ALTER TABLE public.todo_subtasks 
ADD COLUMN module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL;