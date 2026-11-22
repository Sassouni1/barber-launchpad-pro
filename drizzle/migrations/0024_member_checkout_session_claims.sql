CREATE TABLE public.member_checkout_claims (
  checkout_session_id text PRIMARY KEY CHECK (checkout_session_id ~ '^cs_live_[A-Za-z0-9]{10,200}$'),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','claimed','released','needs_review')),
  reservation_id uuid NOT NULL,
  reserved_until timestamptz NOT NULL,
  user_id uuid UNIQUE,
  login_email_normalized text,
  checkout_email_normalized text,
  payment_intent_id text UNIQUE,
  charge_id text UNIQUE,
  amount_cents integer,
  currency text,
  paid_at timestamptz,
  grant_id uuid,
  attempts integer NOT NULL DEFAULT 1,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.member_checkout_claims TO authenticated;
GRANT ALL ON public.member_checkout_claims TO service_role;
ALTER TABLE public.member_checkout_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read checkout claims" ON public.member_checkout_claims
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.member_checkout_claims IS 'Single-use binding of one paid live Barber Launch checkout session to one newly created member account. Written only by member-checkout-signup via the claim functions.';

-- Does any account already use this email? (service role only)
CREATE OR REPLACE FUNCTION public.member_checkout_email_has_account(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE lower(trim(u.email)) = lower(trim(_email)))
$$;

-- Atomically reserve a session for one account creation attempt.
CREATE OR REPLACE FUNCTION public.member_checkout_claim_reserve(
  _session_id text, _reservation uuid, _payment_intent text, _charge text,
  _checkout_email text, _login_email text, _amount integer, _currency text, _paid_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.member_checkout_claims;
BEGIN
  BEGIN
    INSERT INTO public.member_checkout_claims (checkout_session_id, status, reservation_id, reserved_until,
      login_email_normalized, checkout_email_normalized, payment_intent_id, charge_id, amount_cents, currency, paid_at)
    VALUES (_session_id, 'reserved', _reservation, now() + interval '10 minutes',
      _login_email, _checkout_email, _payment_intent, _charge, _amount, _currency, _paid_at)
    ON CONFLICT (checkout_session_id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_claimed';
  END;
  IF FOUND THEN RETURN 'reserved'; END IF;

  SELECT * INTO r FROM public.member_checkout_claims WHERE checkout_session_id = _session_id FOR UPDATE;
  IF r.status IN ('claimed', 'needs_review') THEN RETURN 'already_claimed'; END IF;
  IF r.status = 'reserved' AND r.reserved_until > now() THEN RETURN 'in_progress'; END IF;
  IF r.status = 'reserved' AND r.user_id IS NOT NULL THEN
    UPDATE public.member_checkout_claims SET status = 'needs_review', last_error = 'abandoned_after_account_create', updated_at = now()
    WHERE checkout_session_id = _session_id;
    RETURN 'already_claimed';
  END IF;
  UPDATE public.member_checkout_claims SET status = 'reserved', reservation_id = _reservation,
    reserved_until = now() + interval '10 minutes', login_email_normalized = _login_email,
    attempts = attempts + 1, last_error = NULL, updated_at = now()
  WHERE checkout_session_id = _session_id;
  RETURN 'reserved';
END;
$$;

CREATE OR REPLACE FUNCTION public.member_checkout_claim_attach_user(_session_id text, _reservation uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.member_checkout_claims SET user_id = _user_id, updated_at = now()
  WHERE checkout_session_id = _session_id AND reservation_id = _reservation AND status = 'reserved' AND user_id IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.member_checkout_claim_release(_session_id text, _reservation uuid, _error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.member_checkout_claims SET status = 'released', user_id = NULL, last_error = left(_error, 200), updated_at = now()
  WHERE checkout_session_id = _session_id AND reservation_id = _reservation AND status = 'reserved';
  RETURN FOUND;
END;
$$;

-- Bind the reserved session to the new account: member access tied to this exact payment, audited.
CREATE OR REPLACE FUNCTION public.member_checkout_claim_complete(_session_id text, _reservation uuid, _user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.member_checkout_claims; g public.member_access_grants; _grant uuid;
BEGIN
  SELECT * INTO r FROM public.member_checkout_claims WHERE checkout_session_id = _session_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'reserved' OR r.reservation_id <> _reservation OR r.user_id IS DISTINCT FROM _user_id THEN
    RETURN 'not_reserved';
  END IF;

  SELECT * INTO g FROM public.member_access_grants WHERE source = 'stripe_checkout' AND evidence_ref = _session_id FOR UPDATE;
  IF FOUND THEN
    IF g.status <> 'active' OR (g.user_id IS NOT NULL AND g.user_id <> _user_id) THEN
      UPDATE public.member_checkout_claims SET status = 'needs_review',
        last_error = CASE WHEN g.status <> 'active' THEN 'grant_revoked' ELSE 'grant_bound_elsewhere' END, updated_at = now()
      WHERE checkout_session_id = _session_id;
      RETURN CASE WHEN g.status <> 'active' THEN 'revoked' ELSE 'bound_elsewhere' END;
    END IF;
    UPDATE public.member_access_grants SET user_id = _user_id WHERE id = g.id;
    _grant := g.id;
  ELSE
    INSERT INTO public.member_access_grants (user_id, email_normalized, source, evidence_ref, amount_cents, currency, paid_at, status, status_reason, note)
    VALUES (_user_id, r.checkout_email_normalized, 'stripe_checkout', _session_id, r.amount_cents, r.currency, r.paid_at, 'active',
            'checkout_session_claim', 'Bound to the account created with this paid checkout session')
    RETURNING id INTO _grant;
  END IF;

  -- The same payment cannot later qualify another account through the checkout email.
  IF r.charge_id IS NOT NULL THEN
    UPDATE public.member_access_grants SET user_id = _user_id
    WHERE user_id IS NULL AND source = 'stripe_charge' AND evidence_ref = r.charge_id;
  END IF;

  UPDATE public.member_checkout_claims SET status = 'claimed', claimed_at = now(), grant_id = _grant, updated_at = now()
  WHERE checkout_session_id = _session_id;

  INSERT INTO public.member_access_events (grant_id, user_id, email_normalized, action, reason, details)
  VALUES (_grant, _user_id, r.login_email_normalized, 'checkout_claimed', 'checkout_session_claim',
          jsonb_build_object('checkout_session_id', _session_id,
                             'login_email_differs', r.login_email_normalized IS DISTINCT FROM r.checkout_email_normalized));
  RETURN 'claimed';
END;
$$;

REVOKE ALL ON FUNCTION public.member_checkout_email_has_account(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_checkout_claim_reserve(text, uuid, text, text, text, text, integer, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_checkout_claim_attach_user(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_checkout_claim_release(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_checkout_claim_complete(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_checkout_email_has_account(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_checkout_claim_reserve(text, uuid, text, text, text, text, integer, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_checkout_claim_attach_user(text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_checkout_claim_release(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_checkout_claim_complete(text, uuid, uuid) TO service_role;