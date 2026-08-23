CREATE TABLE IF NOT EXISTS public.member_onboarding_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_types text[] NOT NULL DEFAULT '{}',
  business_name text,
  name_help_requested boolean NOT NULL DEFAULT false,
  name_brainstorm_notes text,
  name_brainstorm_result text,
  logo_url text,
  logo_help_requested boolean NOT NULL DEFAULT false,
  instagram_status text,
  instagram_handle text,
  services text[] NOT NULL DEFAULT '{}',
  custom_services text[] NOT NULL DEFAULT '{}',
  hours_text text,
  booking_method text,
  booking_platform text,
  photo_url text,
  guidance_requested boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_profiles_business_types_check') THEN
    ALTER TABLE public.member_onboarding_profiles
      ADD CONSTRAINT member_onboarding_profiles_business_types_check
      CHECK (business_types <@ ARRAY['salon_owner','barbershop_owner','stylist','barber','private_suite_owner','other']::text[]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_profiles_instagram_status_check') THEN
    ALTER TABLE public.member_onboarding_profiles
      ADD CONSTRAINT member_onboarding_profiles_instagram_status_check
      CHECK (instagram_status IS NULL OR instagram_status IN ('yes','no','help'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_onboarding_profiles_booking_method_check') THEN
    ALTER TABLE public.member_onboarding_profiles
      ADD CONSTRAINT member_onboarding_profiles_booking_method_check
      CHECK (booking_method IS NULL OR booking_method IN ('manual','calendar','looking','help'));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_onboarding_profiles TO authenticated;
GRANT ALL ON public.member_onboarding_profiles TO service_role;

ALTER TABLE public.member_onboarding_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their own onboarding profile" ON public.member_onboarding_profiles;
CREATE POLICY "Members can view their own onboarding profile"
  ON public.member_onboarding_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can create their own onboarding profile" ON public.member_onboarding_profiles;
CREATE POLICY "Members can create their own onboarding profile"
  ON public.member_onboarding_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update their own onboarding profile" ON public.member_onboarding_profiles;
CREATE POLICY "Members can update their own onboarding profile"
  ON public.member_onboarding_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all onboarding profiles" ON public.member_onboarding_profiles;
CREATE POLICY "Admins can view all onboarding profiles"
  ON public.member_onboarding_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_member_onboarding_profiles_updated_at ON public.member_onboarding_profiles;
CREATE TRIGGER update_member_onboarding_profiles_updated_at
  BEFORE UPDATE ON public.member_onboarding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies
DROP POLICY IF EXISTS "Members can upload their own onboarding assets" ON storage.objects;
CREATE POLICY "Members can upload their own onboarding assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-onboarding-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Members can view their own onboarding assets" ON storage.objects;
CREATE POLICY "Members can view their own onboarding assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'member-onboarding-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Members can update their own onboarding assets" ON storage.objects;
CREATE POLICY "Members can update their own onboarding assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'member-onboarding-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'member-onboarding-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Members can delete their own onboarding assets" ON storage.objects;
CREATE POLICY "Members can delete their own onboarding assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'member-onboarding-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Admins can view onboarding assets" ON storage.objects;
CREATE POLICY "Admins can view onboarding assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'member-onboarding-assets' AND public.has_role(auth.uid(), 'admin'));