CREATE TABLE public.website_hair_system_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  website_id uuid NOT NULL REFERENCES public.member_websites(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  concern text NOT NULL,
  notes text NOT NULL DEFAULT '',
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
  sms_status text NOT NULL DEFAULT 'pending' CHECK (sms_status IN ('pending','sent','failed')),
  email_provider_id text,
  sms_provider_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX website_hair_system_inquiries_member_created
  ON public.website_hair_system_inquiries (member_id, created_at DESC);

ALTER TABLE public.website_hair_system_inquiries ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.website_hair_system_inquiries TO authenticated;
GRANT ALL ON public.website_hair_system_inquiries TO service_role;
CREATE POLICY "Members read their own website inquiries"
  ON public.website_hair_system_inquiries FOR SELECT TO authenticated
  USING (auth.uid() = member_id);
