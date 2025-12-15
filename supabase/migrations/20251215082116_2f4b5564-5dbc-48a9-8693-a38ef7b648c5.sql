-- Add signature_data column to store the drawn signature
ALTER TABLE public.profiles 
ADD COLUMN signature_data text DEFAULT NULL;