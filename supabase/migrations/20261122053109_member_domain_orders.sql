-- A paid member checkout is required before Barber Launch buys a domain.
-- Members may read their own order; only server functions can create or change it.
CREATE TABLE public.member_domain_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  domain text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  cloudflare_cost_cents integer NOT NULL CHECK (cloudflare_cost_cents > 0),
  member_charge_cents integer NOT NULL CHECK (member_charge_cents > 0),
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'checkout_pending'
    CHECK (status IN ('checkout_pending', 'checkout_open', 'paid', 'registering', 'registration_pending', 'registered', 'action_required', 'failed')),
  cloudflare_registration_state text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX member_domain_orders_user_idx ON public.member_domain_orders (user_id, created_at DESC);
ALTER TABLE public.member_domain_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_domain_orders FROM anon, authenticated;
GRANT SELECT ON public.member_domain_orders TO authenticated;
GRANT ALL ON public.member_domain_orders TO service_role;
CREATE POLICY "Members see their own domain orders" ON public.member_domain_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
