-- Isolated Stripe TEST-mode hair-system tables. Independently removable; never
-- referenced by production orders, receipts, reconciliation or replay.
CREATE TABLE public.hair_system_test_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  base_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_speed text NOT NULL,
  stripe_checkout_session_id text UNIQUE CHECK (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id LIKE 'cs_test_%'),
  status text NOT NULL DEFAULT 'open',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hair_system_test_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.hair_system_test_drafts(id),
  stripe_checkout_session_id text NOT NULL CHECK (stripe_checkout_session_id LIKE 'cs_test_%'),
  system_index integer NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  order_details jsonb NOT NULL,
  receipt jsonb,
  amount_total_minor integer,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_checkout_session_id, system_index)
);
CREATE TABLE public.hair_system_test_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_checkout_session_id text NOT NULL,
  test_order_id uuid REFERENCES public.hair_system_test_orders(id),
  channel text NOT NULL,
  intended_recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'captured_not_sent' CHECK (status = 'captured_not_sent'),
  outbound_calls integer NOT NULL DEFAULT 0 CHECK (outbound_calls = 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_checkout_session_id, test_order_id, channel)
);
CREATE TABLE public.hair_system_test_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL CHECK (livemode = false),
  status text NOT NULL DEFAULT 'processing',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hair_system_test_drafts, public.hair_system_test_orders,
  public.hair_system_test_notifications, public.hair_system_test_webhook_events TO authenticated;
GRANT ALL ON public.hair_system_test_drafts, public.hair_system_test_orders,
  public.hair_system_test_notifications, public.hair_system_test_webhook_events TO service_role;

ALTER TABLE public.hair_system_test_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hair_system_test_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hair_system_test_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hair_system_test_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read test drafts" ON public.hair_system_test_drafts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read test orders" ON public.hair_system_test_orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read test notifications" ON public.hair_system_test_notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read test webhook events" ON public.hair_system_test_webhook_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));