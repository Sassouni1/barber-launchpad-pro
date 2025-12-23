
-- Add notes_content column to modules table for simpler markdown-style notes
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS notes_content text;

-- We can keep the old tables for now in case there's data, but won't use them
