-- Add is_published column to courses table
ALTER TABLE public.courses ADD COLUMN is_published boolean NOT NULL DEFAULT true;

-- Add is_published column to modules table  
ALTER TABLE public.modules ADD COLUMN is_published boolean NOT NULL DEFAULT true;