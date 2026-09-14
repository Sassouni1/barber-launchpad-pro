CREATE TABLE public.affiliate_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL UNIQUE REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stripe_account_id text NOT NULL,
  source text NOT NULL DEFAULT 'existing_connect',
  country text,
  default_currency text,
  account_type text,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  transfers_capability text,
  disabled_reason text,
  currently_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_verification jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_account_last4 text,
  external_account_bank_name text,
  eligible boolean NOT NULL DEFAULT false,
  ineligible_reason text,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.affiliate_payout_accounts TO authenticated;
GRANT ALL ON public.affiliate_payout_accounts TO service_role;
ALTER TABLE public.affiliate_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates read their own payout account"
ON public.affiliate_payout_accounts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
);

CREATE TRIGGER trg_affiliate_payout_accounts_updated_at
BEFORE UPDATE ON public.affiliate_payout_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.affiliate_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL UNIQUE REFERENCES public.affiliate_commissions(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  destination_account_id text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued',
  release_after timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  stripe_transfer_id text,
  stripe_destination_payment_id text,
  stripe_payout_id text,
  payout_status text,
  payout_arrival_at timestamptz,
  failure_code text,
  failure_message text,
  livemode boolean NOT NULL DEFAULT true,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_transfers_status_check CHECK (status IN ('queued','processing','sent','paid','failed','blocked','canceled'))
);

CREATE INDEX idx_affiliate_transfers_due ON public.affiliate_transfers (status, next_attempt_at);
CREATE INDEX idx_affiliate_transfers_affiliate ON public.affiliate_transfers (affiliate_id, created_at DESC);
CREATE UNIQUE INDEX idx_affiliate_transfers_stripe_id ON public.affiliate_transfers (stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;

GRANT SELECT ON public.affiliate_transfers TO authenticated;
GRANT ALL ON public.affiliate_transfers TO service_role;
ALTER TABLE public.affiliate_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates read their own transfers"
ON public.affiliate_transfers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
);

CREATE TRIGGER trg_affiliate_transfers_updated_at
BEFORE UPDATE ON public.affiliate_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.affiliate_payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  stripe_account_id text,
  stripe_transfer_id text,
  stripe_payout_id text,
  livemode boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.affiliate_payout_events TO authenticated;
GRANT ALL ON public.affiliate_payout_events TO service_role;
ALTER TABLE public.affiliate_payout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read affiliate payout events"
ON public.affiliate_payout_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));