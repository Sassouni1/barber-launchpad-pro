REVOKE ALL ON public.website_hair_system_inquiries FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.website_hair_system_inquiries FROM authenticated;
GRANT SELECT ON public.website_hair_system_inquiries TO authenticated;
GRANT ALL ON public.website_hair_system_inquiries TO service_role;

ALTER TABLE public.website_hair_system_inquiries
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS sms_error text,
  ADD COLUMN IF NOT EXISTS email_provider_status text,
  ADD COLUMN IF NOT EXISTS sms_provider_status text,
  ADD COLUMN IF NOT EXISTS ghl_contact_id text,
  ADD COLUMN IF NOT EXISTS notified_phone_last4 text,
  ADD COLUMN IF NOT EXISTS origin_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.website_hair_system_inquiries DROP CONSTRAINT IF EXISTS website_hair_system_inquiries_email_status_check;
ALTER TABLE public.website_hair_system_inquiries DROP CONSTRAINT IF EXISTS website_hair_system_inquiries_sms_status_check;
ALTER TABLE public.website_hair_system_inquiries
  ADD CONSTRAINT website_hair_system_inquiries_email_status_check CHECK (email_status IN ('pending','sending','sent','failed','uncertain')),
  ADD CONSTRAINT website_hair_system_inquiries_sms_status_check CHECK (sms_status IN ('pending','sending','sent','failed','uncertain'));

CREATE INDEX IF NOT EXISTS website_hair_system_inquiries_site_created
  ON public.website_hair_system_inquiries (website_id, created_at DESC);