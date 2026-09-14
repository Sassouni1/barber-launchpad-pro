ALTER TABLE public.affiliate_referrals
  DROP CONSTRAINT IF EXISTS affiliate_referrals_status_check;

ALTER TABLE public.affiliate_referrals
  ADD COLUMN IF NOT EXISTS booking_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_source text;

UPDATE public.affiliate_referrals
  SET status = 'call_requested'
  WHERE status = 'booked' AND booking_confirmed_at IS NULL;

ALTER TABLE public.affiliate_referrals
  ADD CONSTRAINT affiliate_referrals_status_check
  CHECK (status IN ('lead','call_requested','booked','checkout_started','converted','void'));

CREATE TABLE IF NOT EXISTS public.affiliate_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  submitted_email_normalized text NOT NULL,
  submitted_name text,
  ip_hash text,
  stripe_session_id text,
  stripe_session_url text,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.affiliate_checkout_intents TO service_role;

ALTER TABLE public.affiliate_checkout_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view checkout intents"
  ON public.affiliate_checkout_intents FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_affiliate_checkout_intents_referral
  ON public.affiliate_checkout_intents (referral_id, created_at DESC);

CREATE TRIGGER update_affiliate_checkout_intents_updated_at
  BEFORE UPDATE ON public.affiliate_checkout_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();