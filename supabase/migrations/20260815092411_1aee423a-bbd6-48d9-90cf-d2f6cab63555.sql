CREATE TABLE public.ad_billing_profiles (
  customer_id uuid PRIMARY KEY,
  stripe_customer_id text,
  default_payment_method_id text,
  autopay_enabled boolean NOT NULL DEFAULT false,
  autopay_consent_at timestamptz,
  auto_recharge_amount_cents integer NOT NULL DEFAULT 2000,
  currency text NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_billing_profiles_recharge_min CHECK (auto_recharge_amount_cents >= 200)
);

GRANT SELECT ON public.ad_billing_profiles TO authenticated;
GRANT ALL ON public.ad_billing_profiles TO service_role;
ALTER TABLE public.ad_billing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own billing profile" ON public.ad_billing_profiles
FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins read all billing profiles" ON public.ad_billing_profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ad_billing_profiles_updated_at
BEFORE UPDATE ON public.ad_billing_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ad_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.ad_campaigns(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  purpose text NOT NULL DEFAULT 'initial_funding',
  status text NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  idempotency_key uuid NOT NULL UNIQUE,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_payment_transactions_amount_min CHECK (amount_cents >= 200),
  CONSTRAINT ad_payment_transactions_status_check CHECK (status IN ('pending','requires_action','succeeded','failed','canceled'))
);

CREATE INDEX idx_ad_payment_transactions_customer_created
  ON public.ad_payment_transactions (customer_id, created_at DESC);

GRANT SELECT ON public.ad_payment_transactions TO authenticated;
GRANT ALL ON public.ad_payment_transactions TO service_role;
ALTER TABLE public.ad_payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own payment transactions" ON public.ad_payment_transactions
FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins read all payment transactions" ON public.ad_payment_transactions
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ad_payment_transactions_updated_at
BEFORE UPDATE ON public.ad_payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ad_spend_ledger_entries
  ADD COLUMN payment_transaction_id uuid REFERENCES public.ad_payment_transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_ad_spend_ledger_payment_transaction
  ON public.ad_spend_ledger_entries (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

CREATE TABLE public.ad_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_campaign_events_customer_created
  ON public.ad_campaign_events (customer_id, created_at DESC);

GRANT SELECT ON public.ad_campaign_events TO authenticated;
GRANT ALL ON public.ad_campaign_events TO service_role;
ALTER TABLE public.ad_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own campaign events" ON public.ad_campaign_events
FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins read all campaign events" ON public.ad_campaign_events
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.sync_ad_campaign_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_campaign_customer uuid;
BEGIN
  IF NEW.entry_type <> 'funding' OR NEW.payment_transaction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT customer_id INTO v_campaign_customer
  FROM public.ad_campaigns
  WHERE id = NEW.campaign_id;

  IF v_campaign_customer IS NULL OR v_campaign_customer <> NEW.customer_id THEN
    RAISE EXCEPTION 'Ledger entry customer does not match campaign owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ad_payment_transactions t
    WHERE t.id = NEW.payment_transaction_id
      AND t.customer_id = NEW.customer_id
      AND t.campaign_id = NEW.campaign_id
      AND t.status = 'succeeded'
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.ad_campaigns
  SET funded_cents = funded_cents + NEW.amount_cents
  WHERE id = NEW.campaign_id
    AND customer_id = NEW.customer_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_ad_campaign_financials
AFTER INSERT ON public.ad_spend_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_ad_campaign_financials();