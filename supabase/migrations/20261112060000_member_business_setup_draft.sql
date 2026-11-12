ALTER TABLE public.member_onboarding_profiles
  ADD COLUMN IF NOT EXISTS business_setup_draft jsonb,
  ADD COLUMN IF NOT EXISTS business_setup_draft_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_onboarding_business_setup_draft_object_check'
  ) THEN
    ALTER TABLE public.member_onboarding_profiles
      ADD CONSTRAINT member_onboarding_business_setup_draft_object_check
      CHECK (business_setup_draft IS NULL OR jsonb_typeof(business_setup_draft) = 'object');
  END IF;
END $$;
