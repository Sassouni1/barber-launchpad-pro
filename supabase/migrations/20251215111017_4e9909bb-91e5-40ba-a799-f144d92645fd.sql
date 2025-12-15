-- Add category column to courses table
ALTER TABLE public.courses 
ADD COLUMN category text NOT NULL DEFAULT 'hair-system';

-- Update the existing course to be hair-system category
UPDATE public.courses SET category = 'hair-system' WHERE category IS NULL OR category = 'hair-system';