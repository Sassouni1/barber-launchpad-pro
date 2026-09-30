CREATE TABLE public.hair_system_checkout_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  base_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_speed text,
  save_card boolean NOT NULL DEFAULT false,
  stripe_checkout_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'open',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hair_system_checkout_drafts TO service_role;
ALTER TABLE public.hair_system_checkout_drafts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_hair_system_checkout_drafts_updated_at BEFORE UPDATE ON public.hair_system_checkout_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS checkout_draft_id uuid,
  ADD COLUMN IF NOT EXISTS system_index integer,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_key ON public.orders (payment_reference) WHERE payment_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_session_system_key ON public.orders (stripe_checkout_session_id, system_index) WHERE stripe_checkout_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hair_system_materialize_paid_draft(_draft_id uuid, _session_id text, _user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d public.hair_system_checkout_drafts%ROWTYPE;
  n integer;
  i integer;
  ids uuid[] := '{}';
  v_id uuid;
BEGIN
  IF _draft_id IS NULL OR _session_id IS NULL OR _session_id !~ '^cs_(live|test)_' THEN
    RAISE EXCEPTION 'invalid_draft_reference';
  END IF;
  SELECT * INTO d FROM public.hair_system_checkout_drafts WHERE id = _draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'draft_not_found'; END IF;
  IF d.user_id <> _user_id THEN RAISE EXCEPTION 'draft_user_mismatch'; END IF;
  IF d.stripe_checkout_session_id IS DISTINCT FROM _session_id THEN RAISE EXCEPTION 'draft_session_mismatch'; END IF;

  n := jsonb_array_length(d.systems);
  IF n < 1 THEN RAISE EXCEPTION 'draft_has_no_systems'; END IF;

  FOR i IN 0..n-1 LOOP
    INSERT INTO public.orders (user_id, customer_email, customer_name, status, order_details,
      payment_reference, checkout_draft_id, system_index, stripe_checkout_session_id)
    VALUES (d.user_id, d.customer_email, d.customer_name, 'pending',
      d.base_details || (d.systems -> i) || jsonb_build_object('order_number', i + 1, 'total_orders', n),
      'stripe:' || _session_id || ':' || i, d.id, i, _session_id)
    ON CONFLICT (payment_reference) WHERE payment_reference IS NOT NULL DO NOTHING;
    SELECT id INTO v_id FROM public.orders WHERE payment_reference = 'stripe:' || _session_id || ':' || i;
    ids := ids || v_id;
  END LOOP;

  UPDATE public.hair_system_checkout_drafts SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = d.id;
  RETURN ids;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.hair_system_materialize_paid_draft(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hair_system_materialize_paid_draft(uuid, text, uuid) TO service_role;