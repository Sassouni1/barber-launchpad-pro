-- Create table for tracking training game completions
CREATE TABLE public.user_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_type text NOT NULL, -- 'color-match', 'hairline', 'ceran-wrap'
  completed boolean NOT NULL DEFAULT false,
  score integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, game_type)
);

-- Enable RLS
ALTER TABLE public.user_training_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own progress
CREATE POLICY "Users can view own training progress" 
ON public.user_training_progress 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own training progress" 
ON public.user_training_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own training progress" 
ON public.user_training_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admins can view all training progress
CREATE POLICY "Admins can view all training progress" 
ON public.user_training_progress 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));