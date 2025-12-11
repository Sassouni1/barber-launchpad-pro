-- Add lesson-like fields to modules table
ALTER TABLE public.modules 
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS duration text,
ADD COLUMN IF NOT EXISTS has_quiz boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_download boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS has_homework boolean NOT NULL DEFAULT false;