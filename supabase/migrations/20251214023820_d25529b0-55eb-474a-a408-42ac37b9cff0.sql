-- Add due_days column to dynamic_todo_lists for expected completion timeframe
ALTER TABLE public.dynamic_todo_lists
ADD COLUMN due_days integer DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.dynamic_todo_lists.due_days IS 'Number of days from user signup to complete this list';