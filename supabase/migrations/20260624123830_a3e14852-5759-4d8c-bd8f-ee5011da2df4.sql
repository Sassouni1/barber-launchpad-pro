
CREATE TABLE public.barber_launch_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  onboarding_started_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.barber_launch_stripe_accounts TO authenticated;
GRANT ALL ON public.barber_launch_stripe_accounts TO service_role;

ALTER TABLE public.barber_launch_stripe_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own stripe account"
  ON public.barber_launch_stripe_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_bl_stripe_accounts_updated_at
  BEFORE UPDATE ON public.barber_launch_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.barber_launch_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  template_key text NOT NULL,
  display_name text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_product_id text,
  stripe_price_id text,
  stripe_payment_link_id text,
  url text,
  active boolean NOT NULL DEFAULT true,
  payment_method_types text[] NOT NULL DEFAULT ARRAY['card','klarna']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_key)
);

GRANT SELECT ON public.barber_launch_payment_links TO authenticated;
GRANT ALL ON public.barber_launch_payment_links TO service_role;

ALTER TABLE public.barber_launch_payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own payment links"
  ON public.barber_launch_payment_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_bl_payment_links_updated_at
  BEFORE UPDATE ON public.barber_launch_payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
