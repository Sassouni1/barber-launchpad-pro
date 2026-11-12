ALTER TABLE public.member_onboarding_profiles
  ADD COLUMN IF NOT EXISTS workplace_other_description text;
