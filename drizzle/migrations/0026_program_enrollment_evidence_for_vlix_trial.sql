-- Verified paid Barber Launch program enrollments (GHL payment_link orders in
-- The Barber Launch location, re-read from Stripe). Server-only: no browser
-- role can read or write it. One row per GHL order and per PaymentIntent.
CREATE TABLE public.program_enrollment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_order_id text NOT NULL UNIQUE CHECK (ghl_order_id ~ '^[a-f0-9]{24}$'),
  ghl_location_id text NOT NULL CHECK (ghl_location_id = 'JVBUuL3dVwZahuGay9T1'),
  ghl_contact_id text NOT NULL,
  stripe_payment_intent_id text NOT NULL UNIQUE CHECK (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  stripe_charge_id text NOT NULL,
  offer_description text NOT NULL,
  amount_received_minor integer NOT NULL CHECK (amount_received_minor > 0),
  currency text NOT NULL CHECK (currency = 'usd'),
  contact_email_normalized text,
  billing_email_normalized text,
  order_created_at timestamptz NOT NULL,
  paid_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'revoked')),
  revoked_reason text,
  revoked_at timestamptz,
  source text NOT NULL CHECK (source IN ('stripe_webhook', 'backfill')),
  source_event_id text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_email_normalized IS NOT NULL OR billing_email_normalized IS NOT NULL)
);

REVOKE ALL ON public.program_enrollment_evidence FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.program_enrollment_evidence TO service_role;
ALTER TABLE public.program_enrollment_evidence ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) can use this table.

CREATE INDEX program_enrollment_evidence_contact_email_idx
  ON public.program_enrollment_evidence (contact_email_normalized) WHERE status = 'verified';
CREATE INDEX program_enrollment_evidence_billing_email_idx
  ON public.program_enrollment_evidence (billing_email_normalized) WHERE status = 'verified';

CREATE TRIGGER program_enrollment_evidence_touch
  BEFORE UPDATE ON public.program_enrollment_evidence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.program_enrollment_evidence IS
  'Server-only verified paid program enrollments (GHL order + fresh Stripe PaymentIntent/charge). Used by vlix-certification-status trial fields.';

-- Certification facts for the Vlix bridge: same certificate definition as
-- vlix_has_issued_hair_system_certificate, plus the earliest issue date and
-- whether a confirmed Auth account exists for the email.
CREATE OR REPLACE FUNCTION public.vlix_certification_facts(p_email text)
RETURNS TABLE (confirmed_account boolean, certified boolean, certified_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM auth.users AS member
      WHERE lower(member.email) = lower(btrim(p_email))
        AND member.email_confirmed_at IS NOT NULL
    ) AS confirmed_account,
    EXISTS (
      SELECT 1
      FROM auth.users AS member
      JOIN public.certifications AS certificate ON certificate.user_id = member.id
      JOIN public.courses AS course ON course.id = certificate.course_id
      WHERE lower(member.email) = lower(btrim(p_email))
        AND member.email_confirmed_at IS NOT NULL
        AND course.category = 'hair-system'
    ) AS certified,
    (
      SELECT min(certificate.issued_at)
      FROM auth.users AS member
      JOIN public.certifications AS certificate ON certificate.user_id = member.id
      JOIN public.courses AS course ON course.id = certificate.course_id
      WHERE lower(member.email) = lower(btrim(p_email))
        AND member.email_confirmed_at IS NOT NULL
        AND course.category = 'hair-system'
    ) AS certified_at;
$$;

REVOKE ALL ON FUNCTION public.vlix_certification_facts(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vlix_certification_facts(text) TO service_role;