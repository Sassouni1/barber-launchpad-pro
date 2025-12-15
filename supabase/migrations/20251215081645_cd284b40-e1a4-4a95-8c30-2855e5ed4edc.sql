-- Add agreement_signed_at column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN agreement_signed_at timestamp with time zone DEFAULT NULL;