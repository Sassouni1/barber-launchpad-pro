-- 20260813190000_ads_manager_foundation.sql
CREATE TABLE IF NOT EXISTS public.meta_ad_accounts (
  meta_ad_account_id text PRIMARY KEY,
  name text NOT NULL,
  account_mode text NOT NULL DEFAULT 'managed' CHECK (account_mode IN ('managed', 'client_owned')),
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage Meta ad accounts" ON public.meta_ad_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_meta_ad_accounts_updated_at BEFORE UPDATE ON public.meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.meta_ad_accounts (meta_ad_account_id, name, account_mode, active)
VALUES ('698039684068863', 'Barber Launch Managed Account', 'managed', true)
ON CONFLICT (meta_ad_account_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'meta' CHECK (platform IN ('meta')),
  name text NOT NULL,
  objective text NOT NULL DEFAULT 'lead_generation',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'active', 'paused', 'payment_required', 'archived')),
  daily_budget_cents integer NOT NULL DEFAULT 0 CHECK (daily_budget_cents >= 0),
  lifetime_budget_cents integer CHECK (lifetime_budget_cents IS NULL OR lifetime_budget_cents >= 0),
  funded_cents integer NOT NULL DEFAULT 0 CHECK (funded_cents >= 0),
  spent_cents integer NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  meta_ad_account_id text NOT NULL REFERENCES public.meta_ad_accounts(meta_ad_account_id),
  meta_campaign_id text UNIQUE,
  meta_page_id text,
  landing_page_url text,
  audience_notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  launched_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_campaigns_customer_id_idx ON public.ad_campaigns(customer_id);
CREATE INDEX IF NOT EXISTS ad_campaigns_status_idx ON public.ad_campaigns(status);

CREATE TABLE IF NOT EXISTS public.ad_spend_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('funding', 'spend', 'adjustment', 'refund')),
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  note text,
  external_reference text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_spend_ledger_entries_customer_id_idx ON public.ad_spend_ledger_entries(customer_id);
CREATE INDEX IF NOT EXISTS ad_spend_ledger_entries_campaign_id_idx ON public.ad_spend_ledger_entries(campaign_id);

GRANT SELECT ON public.ad_campaigns TO authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
GRANT SELECT ON public.ad_spend_ledger_entries TO authenticated;
GRANT ALL ON public.ad_spend_ledger_entries TO service_role;

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_spend_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own ad campaigns" ON public.ad_campaigns FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage ad campaigns" ON public.ad_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Members can view their own ad ledger" ON public.ad_spend_ledger_entries FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage ad ledger" ON public.ad_spend_ledger_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_ad_campaigns_updated_at BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 20260813200000_enforce_ads_minimum_budget.sql
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_min_daily_budget
  CHECK (daily_budget_cents = 0 OR daily_budget_cents >= 1000);

-- 20260813210000_managed_campaign_engine.sql
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS desired_status text NOT NULL DEFAULT 'paused' CHECK (desired_status IN ('active', 'paused')),
  ADD COLUMN IF NOT EXISTS member_visible boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ad_campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objective text NOT NULL DEFAULT 'lead_generation',
  meta_ad_account_id text NOT NULL REFERENCES public.meta_ad_accounts(meta_ad_account_id),
  default_daily_budget_cents integer NOT NULL DEFAULT 1000 CHECK (default_daily_budget_cents >= 1000),
  creative_notes text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_campaign_templates TO authenticated;
GRANT ALL ON public.ad_campaign_templates TO service_role;
ALTER TABLE public.ad_campaign_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ad campaign templates" ON public.ad_campaign_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Members can view active templates" ON public.ad_campaign_templates FOR SELECT TO authenticated
  USING (active = true);
CREATE TRIGGER trg_ad_campaign_templates_updated_at BEFORE UPDATE ON public.ad_campaign_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotent test seed for Alec Borum
INSERT INTO public.ad_campaigns (
  customer_id, name, objective, status, desired_status, member_visible,
  daily_budget_cents, funded_cents, spent_cents, meta_ad_account_id
)
SELECT p.id, 'Alec Borum — Test Campaign', 'lead_generation', 'payment_required', 'paused', true,
       1000, 0, 0, '698039684068863'
FROM public.profiles p
WHERE p.full_name = 'Alec Borum'
  AND NOT EXISTS (
    SELECT 1 FROM public.ad_campaigns c
    WHERE c.customer_id = p.id AND c.name = 'Alec Borum — Test Campaign'
  );