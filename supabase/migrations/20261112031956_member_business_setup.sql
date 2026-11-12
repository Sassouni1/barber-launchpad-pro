ALTER TABLE public.member_onboarding_profiles
  ADD COLUMN IF NOT EXISTS service_city text,
  ADD COLUMN IF NOT EXISTS work_location_street text,
  ADD COLUMN IF NOT EXISTS work_location_city text,
  ADD COLUMN IF NOT EXISTS work_location_state text,
  ADD COLUMN IF NOT EXISTS work_location_postal_code text,
  ADD COLUMN IF NOT EXISTS business_owner_type text,
  ADD COLUMN IF NOT EXISTS cuts_at_owned_business boolean,
  ADD COLUMN IF NOT EXISTS currently_cutting boolean,
  ADD COLUMN IF NOT EXISTS professional_role text,
  ADD COLUMN IF NOT EXISTS workplace_type text,
  ADD COLUMN IF NOT EXISTS other_professionals_count text,
  ADD COLUMN IF NOT EXISTS website_status text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS booking_app_status text,
  ADD COLUMN IF NOT EXISTS booking_link_status text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS business_setup_completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_owner_type_check') THEN
    ALTER TABLE public.member_onboarding_profiles ADD CONSTRAINT member_onboarding_owner_type_check
      CHECK (business_owner_type IS NULL OR business_owner_type IN ('barbershop', 'salon', 'none'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_professional_role_check') THEN
    ALTER TABLE public.member_onboarding_profiles ADD CONSTRAINT member_onboarding_professional_role_check
      CHECK (professional_role IS NULL OR professional_role IN ('barber', 'stylist', 'both'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_workplace_type_check') THEN
    ALTER TABLE public.member_onboarding_profiles ADD CONSTRAINT member_onboarding_workplace_type_check
      CHECK (workplace_type IS NULL OR workplace_type IN ('barbershop', 'salon', 'suite', 'home', 'mobile', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_other_professionals_count_check') THEN
    ALTER TABLE public.member_onboarding_profiles ADD CONSTRAINT member_onboarding_other_professionals_count_check
      CHECK (other_professionals_count IS NULL OR other_professionals_count IN ('none', 'one', 'two_to_five', 'six_to_ten', 'eleven_plus'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_website_status_check') THEN
    ALTER TABLE public.member_onboarding_profiles ADD CONSTRAINT member_onboarding_website_status_check
      CHECK (website_status IS NULL OR website_status IN ('yes', 'no', 'being_set_up'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_booking_app_status_check') THEN
    ALTER TABLE public.member_onboarding_profiles ADD CONSTRAINT member_onboarding_booking_app_status_check
      CHECK (booking_app_status IS NULL OR booking_app_status IN ('yes', 'no'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_booking_link_status_check') THEN
    ALTER TABLE public.member_onboarding_profiles ADD CONSTRAINT member_onboarding_booking_link_status_check
      CHECK (booking_link_status IS NULL OR booking_link_status IN ('link', 'search'));
  END IF;
END $$;
