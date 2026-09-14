
-- SETTINGS
CREATE TABLE public.affiliate_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.affiliate_settings TO authenticated;
GRANT ALL ON public.affiliate_settings TO service_role;
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage affiliate settings" ON public.affiliate_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- AFFILIATES
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  display_name text,
  contact_email text,
  status text NOT NULL DEFAULT 'active',
  external_only boolean NOT NULL DEFAULT false,
  commission_rate numeric(6,4) NOT NULL DEFAULT 0.20,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliates_status_check CHECK (status IN ('active','suspended'))
);
GRANT SELECT ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read own record" ON public.affiliates
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage affiliates" ON public.affiliates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_affiliates_updated_at BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REFERRALS (private lead PII)
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  lead_name text,
  lead_email text NOT NULL,
  lead_email_normalized text NOT NULL,
  lead_phone text,
  lead_phone_normalized text,
  token_hash text NOT NULL,
  intent text,
  status text NOT NULL DEFAULT 'lead',
  ip_hash text,
  user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_referrals_link_type_check CHECK (link_type IN ('call','pay','both')),
  CONSTRAINT affiliate_referrals_status_check CHECK (status IN ('lead','booked','checkout_started','converted','void'))
);
-- first established referral wins: one owner per lead identity
CREATE UNIQUE INDEX affiliate_referrals_email_unique ON public.affiliate_referrals (lead_email_normalized) WHERE status <> 'void';
CREATE INDEX affiliate_referrals_affiliate_idx ON public.affiliate_referrals (affiliate_id, created_at DESC);
CREATE INDEX affiliate_referrals_phone_idx ON public.affiliate_referrals (lead_phone_normalized) WHERE lead_phone_normalized IS NOT NULL;
GRANT SELECT ON public.affiliate_referrals TO authenticated;
GRANT ALL ON public.affiliate_referrals TO service_role;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referrals" ON public.affiliate_referrals
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_affiliate_referrals_updated_at BEFORE UPDATE ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VERIFIED PAYMENTS (immutable identity)
CREATE TABLE public.affiliate_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  stripe_object_type text NOT NULL,
  stripe_object_id text NOT NULL,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  customer_email_normalized text,
  price_id text,
  currency text NOT NULL,
  gross_amount_cents integer NOT NULL,
  eligible_amount_cents integer NOT NULL,
  refunded_amount_cents integer NOT NULL DEFAULT 0,
  disputed boolean NOT NULL DEFAULT false,
  livemode boolean NOT NULL,
  paid_at timestamptz NOT NULL,
  matched_by text,
  matched_by_admin uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_payments_object_unique UNIQUE (stripe_object_type, stripe_object_id)
);
CREATE INDEX affiliate_payments_affiliate_idx ON public.affiliate_payments (affiliate_id, paid_at DESC);
GRANT SELECT ON public.affiliate_payments TO authenticated;
GRANT ALL ON public.affiliate_payments TO service_role;
ALTER TABLE public.affiliate_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage affiliate payments" ON public.affiliate_payments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- COMMISSION LEDGER
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.affiliate_payments(id) ON DELETE SET NULL,
  entry_type text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  basis_amount_cents integer,
  rate numeric(6,4),
  status text NOT NULL DEFAULT 'verified',
  livemode boolean NOT NULL DEFAULT true,
  note text,
  source_event_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_commissions_entry_type_check CHECK (entry_type IN ('earned','refund','dispute','manual','payout')),
  CONSTRAINT affiliate_commissions_status_check CHECK (status IN ('pending','verified','paid','void'))
);
CREATE UNIQUE INDEX affiliate_commissions_event_unique ON public.affiliate_commissions (source_event_id) WHERE source_event_id IS NOT NULL;
CREATE INDEX affiliate_commissions_affiliate_idx ON public.affiliate_commissions (affiliate_id, created_at DESC);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read own commissions" ON public.affiliate_commissions
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage commissions" ON public.affiliate_commissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PAYOUT RECEIPTS (already-completed external payouts)
CREATE TABLE public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  method text,
  external_reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_payouts_affiliate_idx ON public.affiliate_payouts (affiliate_id, paid_at DESC);
GRANT SELECT ON public.affiliate_payouts TO authenticated;
GRANT ALL ON public.affiliate_payouts TO service_role;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read own payouts" ON public.affiliate_payouts
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins manage payouts" ON public.affiliate_payouts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ADMIN AUDIT
CREATE TABLE public.affiliate_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  affiliate_id uuid,
  referral_id uuid,
  payment_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliate_admin_audit TO authenticated;
GRANT ALL ON public.affiliate_admin_audit TO service_role;
ALTER TABLE public.affiliate_admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read affiliate audit" ON public.affiliate_admin_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- WEBHOOK IDEMPOTENCY
CREATE TABLE public.affiliate_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL,
  payload_digest text,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_webhook_events TO service_role;
ALTER TABLE public.affiliate_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read affiliate webhook events" ON public.affiliate_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- PUBLIC INTAKE RATE LIMIT
CREATE TABLE public.affiliate_intake_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  CONSTRAINT affiliate_intake_rate_limits_bucket_unique UNIQUE (bucket_key)
);
GRANT ALL ON public.affiliate_intake_rate_limits TO service_role;
ALTER TABLE public.affiliate_intake_rate_limits ENABLE ROW LEVEL SECURITY;

-- Sanitized totals for the affiliate portal
CREATE OR REPLACE FUNCTION public.affiliate_totals(_affiliate_id uuid)
RETURNS TABLE(referrals bigint, verified_cents bigint, pending_cents bigint, paid_cents bigint, adjustment_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = _affiliate_id AND r.status <> 'void'),
    COALESCE((SELECT sum(c.amount_cents) FROM public.affiliate_commissions c WHERE c.affiliate_id = _affiliate_id AND c.status = 'verified' AND c.entry_type <> 'payout'),0),
    COALESCE((SELECT sum(c.amount_cents) FROM public.affiliate_commissions c WHERE c.affiliate_id = _affiliate_id AND c.status = 'pending'),0),
    COALESCE((SELECT sum(p.amount_cents) FROM public.affiliate_payouts p WHERE p.affiliate_id = _affiliate_id),0),
    COALESCE((SELECT sum(c.amount_cents) FROM public.affiliate_commissions c WHERE c.affiliate_id = _affiliate_id AND c.entry_type IN ('refund','dispute')),0)
  WHERE EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = _affiliate_id AND (a.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  );
$$;

INSERT INTO public.affiliate_settings (key, value) VALUES
  ('program', jsonb_build_object(
     'live_enabled', false,
     'seller_account_confirmed', false,
     'enrollment_price_ids', '[]'::jsonb,
     'sales_call_url', null,
     'attribution_window_days', null,
     'payout_timing', null,
     'terms_text', null
   ))
ON CONFLICT (key) DO NOTHING;
