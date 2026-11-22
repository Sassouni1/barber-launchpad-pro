-- Links a member to one Stripe Customer only through a guarded server function:
-- a stored link is never replaced, and one Customer can never belong to two members.
ALTER TABLE public.member_billing_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_source text,
  ADD COLUMN IF NOT EXISTS stripe_customer_verified_at timestamptz;

-- Keep all paths, including older edge-function versions, from assigning a
-- Stripe Customer to more than one member. Resolve any existing duplicates
-- before applying this migration; do not silently pick an owner.
CREATE UNIQUE INDEX IF NOT EXISTS member_billing_profiles_stripe_customer_unique
  ON public.member_billing_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.link_member_stripe_customer(
  _user_id uuid,
  _stripe_customer_id text,
  _source text,
  _payment_method_id text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_customer text;
BEGIN
  IF _user_id IS NULL OR coalesce(_stripe_customer_id, '') !~ '^cus_[A-Za-z0-9]+$' OR coalesce(_source, '') = '' THEN
    RAISE EXCEPTION 'invalid billing link request';
  END IF;
  IF _payment_method_id IS NOT NULL AND _payment_method_id !~ '^pm_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  -- Serialize every link attempt for this Customer across members.
  PERFORM pg_advisory_xact_lock(hashtextextended('member_stripe_customer:' || _stripe_customer_id, 0));

  IF EXISTS (SELECT 1 FROM public.member_billing_profiles
             WHERE stripe_customer_id = _stripe_customer_id AND customer_id <> _user_id) THEN
    RETURN 'customer_owned_by_other';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN 'no_profile';
  END IF;

  INSERT INTO public.member_billing_profiles (customer_id) VALUES (_user_id)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT stripe_customer_id INTO current_customer
  FROM public.member_billing_profiles WHERE customer_id = _user_id FOR UPDATE;

  IF current_customer IS NOT NULL AND current_customer <> _stripe_customer_id THEN
    RETURN 'member_has_other_customer';
  END IF;

  UPDATE public.member_billing_profiles SET
    stripe_customer_id = _stripe_customer_id,
    stripe_customer_source = CASE WHEN current_customer IS NULL THEN _source ELSE coalesce(stripe_customer_source, _source) END,
    stripe_customer_verified_at = CASE WHEN current_customer IS NULL THEN now() ELSE coalesce(stripe_customer_verified_at, now()) END,
    default_payment_method_id = coalesce(_payment_method_id, default_payment_method_id)
  WHERE customer_id = _user_id;

  RETURN CASE WHEN current_customer IS NULL THEN 'linked' ELSE 'already_linked' END;
EXCEPTION WHEN unique_violation THEN
  RETURN 'customer_owned_by_other';
END;
$$;

REVOKE ALL ON FUNCTION public.link_member_stripe_customer(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_member_stripe_customer(uuid, text, text, text) TO service_role;
