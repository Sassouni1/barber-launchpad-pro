-- Managed campaign engine: members can only operate their own campaigns through
-- authenticated Edge Functions. Templates, payment records, and Meta jobs remain
-- server/admin controlled.

CREATE TABLE public.ad_campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objective text NOT NULL DEFAULT 'lead_generation',
  creative_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  targeting_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  landing_page_url text,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_campaign_templates_creative_config_object CHECK (jsonb_typeof(creative_config) = 'object'),
  CONSTRAINT ad_campaign_templates_targeting_config_object CHECK (jsonb_typeof(targeting_config) = 'object')
);

CREATE UNIQUE INDEX ad_campaign_templates_one_default_idx
  ON public.ad_campaign_templates (is_default) WHERE is_default;
CREATE INDEX ad_campaign_templates_active_idx
  ON public.ad_campaign_templates (active) WHERE active;

ALTER TABLE public.ad_campaigns
  ADD COLUMN template_id uuid REFERENCES public.ad_campaign_templates(id) ON DELETE RESTRICT,
  ADD COLUMN requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN creation_key uuid,
  ADD COLUMN desired_status text NOT NULL DEFAULT 'paused' CHECK (desired_status IN ('active', 'paused')),
  ADD COLUMN meta_adset_id text UNIQUE,
  ADD COLUMN meta_ad_id text UNIQUE,
  ADD COLUMN last_meta_status text,
  ADD COLUMN member_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN last_budget_change_at timestamptz,
  ADD COLUMN last_meta_sync_at timestamptz;

CREATE UNIQUE INDEX ad_campaigns_customer_creation_key_idx
  ON public.ad_campaigns(customer_id, creation_key) WHERE creation_key IS NOT NULL;
CREATE INDEX ad_campaigns_template_id_idx ON public.ad_campaigns(template_id);

CREATE TABLE public.ad_billing_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  default_payment_method_id text,
  autopay_enabled boolean NOT NULL DEFAULT false,
  autopay_consent_at timestamptz,
  recharge_amount_cents integer NOT NULL DEFAULT 7000 CHECK (recharge_amount_cents >= 1000),
  recharge_threshold_cents integer NOT NULL DEFAULT 2000 CHECK (recharge_threshold_cents >= 0),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency = lower(currency)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_billing_profiles_autopay_consent CHECK (NOT autopay_enabled OR autopay_consent_at IS NOT NULL)
);

CREATE TABLE public.ad_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.ad_campaigns(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 1000),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'requires_action', 'processing', 'succeeded', 'failed', 'refunded', 'canceled')),
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  idempotency_key uuid NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'initial_funding' CHECK (purpose IN ('initial_funding', 'recharge', 'manual_topup', 'refund')),
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX ad_payment_transactions_customer_idx ON public.ad_payment_transactions(customer_id, created_at DESC);

ALTER TABLE public.ad_spend_ledger_entries
  ADD COLUMN payment_transaction_id uuid REFERENCES public.ad_payment_transactions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX ad_spend_ledger_entries_payment_transaction_idx
  ON public.ad_spend_ledger_entries(payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

CREATE TABLE public.ad_meta_action_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('create_campaign', 'activate', 'pause', 'update_budget', 'sync_insights')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'retryable_failed', 'failed', 'canceled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  last_error text,
  external_reference text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_meta_action_jobs_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX ad_meta_action_jobs_dispatch_idx ON public.ad_meta_action_jobs(status, run_after, created_at)
  WHERE status IN ('queued', 'retryable_failed');
CREATE INDEX ad_meta_action_jobs_campaign_idx ON public.ad_meta_action_jobs(campaign_id, created_at DESC);

CREATE TABLE public.ad_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_campaign_events_detail_object CHECK (jsonb_typeof(detail) = 'object')
);
CREATE INDEX ad_campaign_events_customer_idx ON public.ad_campaign_events(customer_id, created_at DESC);

-- Keep the denormalized campaign totals derived from append-only ledger entries.
CREATE OR REPLACE FUNCTION public.sync_ad_campaign_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_campaign_id uuid := COALESCE(NEW.campaign_id, OLD.campaign_id);
  expected_customer_id uuid := COALESCE(NEW.customer_id, OLD.customer_id);
BEGIN
  IF TG_OP <> 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ad_campaigns campaign
      WHERE campaign.id = NEW.campaign_id AND campaign.customer_id = NEW.customer_id
    ) THEN
      RAISE EXCEPTION 'Ledger customer must match campaign customer';
    END IF;
  END IF;

  UPDATE public.ad_campaigns campaign
  SET
    funded_cents = COALESCE((
      SELECT SUM(entry.amount_cents)
      FROM public.ad_spend_ledger_entries entry
      WHERE entry.campaign_id = target_campaign_id AND entry.entry_type IN ('funding', 'refund', 'adjustment')
    ), 0),
    spent_cents = COALESCE((
      SELECT -SUM(entry.amount_cents)
      FROM public.ad_spend_ledger_entries entry
      WHERE entry.campaign_id = target_campaign_id AND entry.entry_type = 'spend'
    ), 0)
  WHERE campaign.id = target_campaign_id AND campaign.customer_id = expected_customer_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_ad_campaign_financials
AFTER INSERT OR UPDATE OR DELETE ON public.ad_spend_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_ad_campaign_financials();

CREATE TRIGGER trg_ad_campaign_templates_updated_at BEFORE UPDATE ON public.ad_campaign_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ad_billing_profiles_updated_at BEFORE UPDATE ON public.ad_billing_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ad_meta_action_jobs_updated_at BEFORE UPDATE ON public.ad_meta_action_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ad_campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_meta_action_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaign templates" ON public.ad_campaign_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.claim_next_ad_meta_action_job()
RETURNS SETOF public.ad_meta_action_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT id
    FROM public.ad_meta_action_jobs
    WHERE status IN ('queued', 'retryable_failed')
      AND run_after <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.ad_meta_action_jobs job
  SET status = 'running', locked_at = now(), attempts = attempts + 1
  FROM next_job
  WHERE job.id = next_job.id
  RETURNING job.*;
END;
$$;

CREATE POLICY "Members view their own billing profile" ON public.ad_billing_profiles FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage billing profiles" ON public.ad_billing_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Members view their own payment transactions" ON public.ad_payment_transactions FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage payment transactions" ON public.ad_payment_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Members view their own Meta action jobs" ON public.ad_meta_action_jobs FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage Meta action jobs" ON public.ad_meta_action_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Members view their own campaign events" ON public.ad_campaign_events FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage campaign events" ON public.ad_campaign_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Financial records are append-only for app users. Corrections are separate
-- adjustment/refund rows and the service role is used for provider webhooks.
DROP POLICY IF EXISTS "Admins manage ad ledger" ON public.ad_spend_ledger_entries;
CREATE POLICY "Admins read ad ledger" ON public.ad_spend_ledger_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins append ad ledger entries" ON public.ad_spend_ledger_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
