-- 1) Durable webhook claim: processing -> completed | failed, with safe retry.
ALTER TABLE public.affiliate_webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.affiliate_webhook_events
  DROP CONSTRAINT IF EXISTS affiliate_webhook_events_status_check;
ALTER TABLE public.affiliate_webhook_events
  ADD CONSTRAINT affiliate_webhook_events_status_check
  CHECK (status IN ('processing','completed','failed'));

CREATE OR REPLACE FUNCTION public.affiliate_claim_webhook_event(
  _event_id text,
  _event_type text,
  _livemode boolean,
  _digest text,
  _stale_seconds integer DEFAULT 300
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.affiliate_webhook_events%ROWTYPE;
  v_inserted boolean := false;
BEGIN
  INSERT INTO public.affiliate_webhook_events
    (event_id, event_type, livemode, payload_digest, status, attempts, claimed_at)
  VALUES (_event_id, _event_type, _livemode, _digest, 'processing', 1, now())
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted THEN
    RETURN 'claimed';
  END IF;

  SELECT * INTO v FROM public.affiliate_webhook_events WHERE event_id = _event_id FOR UPDATE;
  IF v.status = 'completed' THEN
    RETURN 'duplicate';
  END IF;
  IF v.status = 'processing' AND v.claimed_at > now() - make_interval(secs => _stale_seconds) THEN
    RETURN 'in_progress';
  END IF;

  UPDATE public.affiliate_webhook_events
  SET status = 'processing', attempts = v.attempts + 1, claimed_at = now(), last_error = NULL
  WHERE event_id = _event_id;
  RETURN 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_complete_webhook_event(
  _event_id text,
  _status text,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('completed','failed') THEN
    RAISE EXCEPTION 'Invalid webhook completion status %', _status;
  END IF;
  UPDATE public.affiliate_webhook_events
  SET status = _status,
      last_error = _error,
      completed_at = CASE WHEN _status = 'completed' THEN now() ELSE NULL END
  WHERE event_id = _event_id;
END;
$$;

-- 2) One earned commission per payment, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commissions_one_earned_per_payment
  ON public.affiliate_commissions (payment_id)
  WHERE entry_type = 'earned' AND payment_id IS NOT NULL;

-- 3) Refunds/disputes that arrive before the sale is recorded.
CREATE TABLE IF NOT EXISTS public.affiliate_pending_adjustments (
  payment_intent_id text PRIMARY KEY,
  refunded_amount_cents integer NOT NULL DEFAULT 0,
  disputed boolean NOT NULL DEFAULT false,
  livemode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_pending_adjustments TO service_role;
ALTER TABLE public.affiliate_pending_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read pending adjustments" ON public.affiliate_pending_adjustments;
CREATE POLICY "Admins read pending adjustments"
  ON public.affiliate_pending_adjustments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Atomic ledger operations.
CREATE OR REPLACE FUNCTION public.affiliate_record_enrollment_payment(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.affiliate_payments%ROWTYPE;
  v_pending public.affiliate_pending_adjustments%ROWTYPE;
  v_rate numeric := COALESCE((_payload->>'rate')::numeric, 0.2);
  v_accrue boolean := COALESCE((_payload->>'accrue')::boolean, false);
  v_eligible integer := COALESCE((_payload->>'eligible_amount_cents')::integer, 0);
  v_gross integer := COALESCE((_payload->>'gross_amount_cents')::integer, 0);
  v_earned integer;
  v_reduction integer;
  v_net integer;
BEGIN
  INSERT INTO public.affiliate_payments (
    referral_id, affiliate_id, stripe_object_type, stripe_object_id, stripe_payment_intent_id,
    stripe_customer_id, customer_email_normalized, price_id, currency, gross_amount_cents,
    eligible_amount_cents, livemode, paid_at, matched_by
  ) VALUES (
    NULLIF(_payload->>'referral_id','')::uuid,
    NULLIF(_payload->>'affiliate_id','')::uuid,
    _payload->>'stripe_object_type',
    _payload->>'stripe_object_id',
    NULLIF(_payload->>'stripe_payment_intent_id',''),
    NULLIF(_payload->>'stripe_customer_id',''),
    NULLIF(_payload->>'customer_email_normalized',''),
    NULLIF(_payload->>'price_id',''),
    COALESCE(_payload->>'currency','usd'),
    v_gross,
    v_eligible,
    COALESCE((_payload->>'livemode')::boolean, true),
    COALESCE((_payload->>'paid_at')::timestamptz, now()),
    NULLIF(_payload->>'matched_by','')
  )
  ON CONFLICT (stripe_object_type, stripe_object_id) DO UPDATE SET
    referral_id = COALESCE(public.affiliate_payments.referral_id, EXCLUDED.referral_id),
    affiliate_id = COALESCE(public.affiliate_payments.affiliate_id, EXCLUDED.affiliate_id),
    stripe_payment_intent_id = COALESCE(EXCLUDED.stripe_payment_intent_id, public.affiliate_payments.stripe_payment_intent_id),
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, public.affiliate_payments.stripe_customer_id),
    customer_email_normalized = COALESCE(EXCLUDED.customer_email_normalized, public.affiliate_payments.customer_email_normalized),
    price_id = COALESCE(EXCLUDED.price_id, public.affiliate_payments.price_id),
    gross_amount_cents = EXCLUDED.gross_amount_cents,
    eligible_amount_cents = EXCLUDED.eligible_amount_cents,
    paid_at = EXCLUDED.paid_at,
    matched_by = COALESCE(public.affiliate_payments.matched_by, EXCLUDED.matched_by),
    updated_at = now()
  RETURNING * INTO v_payment;

  -- Fold in any refund/dispute that arrived before this sale was recorded.
  IF v_payment.stripe_payment_intent_id IS NOT NULL THEN
    SELECT * INTO v_pending FROM public.affiliate_pending_adjustments
    WHERE payment_intent_id = v_payment.stripe_payment_intent_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.affiliate_payments
      SET refunded_amount_cents = GREATEST(refunded_amount_cents, v_pending.refunded_amount_cents),
          disputed = disputed OR v_pending.disputed,
          updated_at = now()
      WHERE id = v_payment.id
      RETURNING * INTO v_payment;
    END IF;
  END IF;

  IF NOT v_accrue OR v_payment.affiliate_id IS NULL OR v_eligible <= 0 THEN
    RETURN jsonb_build_object('payment_id', v_payment.id, 'accrued', false);
  END IF;

  v_earned := ROUND(v_eligible * v_rate);

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, payment_id, entry_type, amount_cents, currency,
    basis_amount_cents, rate, status, livemode, source_event_id
  ) VALUES (
    v_payment.affiliate_id, v_payment.referral_id, v_payment.id, 'earned', v_earned,
    v_payment.currency, v_eligible, v_rate, 'verified', v_payment.livemode,
    NULLIF(_payload->>'source_event_id','')
  )
  ON CONFLICT (payment_id) WHERE entry_type = 'earned' AND payment_id IS NOT NULL
  DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('payment_id', v_payment.id, 'accrued', false, 'already_earned', true);
  END IF;

  -- Refund that landed first must reduce the commission immediately.
  IF v_payment.refunded_amount_cents > 0 THEN
    v_reduction := ROUND(
      v_eligible * LEAST(1, v_payment.refunded_amount_cents::numeric / GREATEST(1, v_gross)) * v_rate
    );
    v_reduction := LEAST(v_reduction, v_earned);
    IF v_reduction > 0 THEN
      INSERT INTO public.affiliate_commissions (
        affiliate_id, referral_id, payment_id, entry_type, amount_cents, currency, rate,
        status, livemode, source_event_id, note
      ) VALUES (
        v_payment.affiliate_id, v_payment.referral_id, v_payment.id, 'refund', -v_reduction,
        v_payment.currency, v_rate, 'verified', v_payment.livemode,
        'pre_accrual_refund_' || v_payment.id::text, 'Refund adjustment (refund received before the sale was recorded)'
      );
    END IF;
  END IF;

  IF v_payment.disputed THEN
    SELECT COALESCE(SUM(amount_cents),0) INTO v_net
    FROM public.affiliate_commissions
    WHERE payment_id = v_payment.id AND entry_type <> 'payout';
    IF v_net > 0 THEN
      INSERT INTO public.affiliate_commissions (
        affiliate_id, referral_id, payment_id, entry_type, amount_cents, currency,
        status, livemode, source_event_id, note
      ) VALUES (
        v_payment.affiliate_id, v_payment.referral_id, v_payment.id, 'dispute', -v_net,
        v_payment.currency, 'verified', v_payment.livemode,
        'pre_accrual_dispute_' || v_payment.id::text, 'Chargeback adjustment (chargeback received before the sale was recorded)'
      );
    END IF;
  END IF;

  IF v_payment.referral_id IS NOT NULL THEN
    UPDATE public.affiliate_referrals SET status = 'converted' WHERE id = v_payment.referral_id;
  END IF;

  RETURN jsonb_build_object('payment_id', v_payment.id, 'accrued', true, 'amount_cents', v_earned);
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_apply_refund(
  _payment_intent_id text,
  _refunded_total_cents integer,
  _event_id text,
  _livemode boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.affiliate_payments%ROWTYPE;
  v_rate numeric;
  v_earned integer;
  v_already integer;
  v_target integer;
  v_reduction integer;
BEGIN
  IF _payment_intent_id IS NULL OR _refunded_total_cents IS NULL THEN
    RETURN jsonb_build_object('status','ignored');
  END IF;

  SELECT * INTO v_payment FROM public.affiliate_payments
  WHERE stripe_payment_intent_id = _payment_intent_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.affiliate_pending_adjustments (payment_intent_id, refunded_amount_cents, livemode)
    VALUES (_payment_intent_id, _refunded_total_cents, _livemode)
    ON CONFLICT (payment_intent_id) DO UPDATE SET
      refunded_amount_cents = GREATEST(public.affiliate_pending_adjustments.refunded_amount_cents, EXCLUDED.refunded_amount_cents),
      updated_at = now();
    RETURN jsonb_build_object('status','pending_payment');
  END IF;

  IF _refunded_total_cents <= v_payment.refunded_amount_cents THEN
    RETURN jsonb_build_object('status','already_applied');
  END IF;

  UPDATE public.affiliate_payments
  SET refunded_amount_cents = _refunded_total_cents, updated_at = now()
  WHERE id = v_payment.id;

  SELECT rate, amount_cents INTO v_rate, v_earned
  FROM public.affiliate_commissions
  WHERE payment_id = v_payment.id AND entry_type = 'earned';

  IF v_earned IS NULL THEN
    -- No commission yet; the recorded refund total is applied when the sale is accrued.
    RETURN jsonb_build_object('status','no_commission_yet');
  END IF;

  -- Total reduction this refund level justifies, minus what has already been taken off.
  v_target := ROUND(
    v_payment.eligible_amount_cents
    * LEAST(1, _refunded_total_cents::numeric / GREATEST(1, v_payment.gross_amount_cents))
    * COALESCE(v_rate, 0.2)
  );
  v_target := LEAST(v_target, v_earned);

  SELECT COALESCE(-SUM(amount_cents),0) INTO v_already
  FROM public.affiliate_commissions
  WHERE payment_id = v_payment.id AND entry_type = 'refund';

  v_reduction := v_target - v_already;
  IF v_reduction <= 0 THEN
    RETURN jsonb_build_object('status','no_change');
  END IF;

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, payment_id, entry_type, amount_cents, currency, rate,
    status, livemode, source_event_id, note
  ) VALUES (
    v_payment.affiliate_id, v_payment.referral_id, v_payment.id, 'refund', -v_reduction,
    v_payment.currency, v_rate, 'verified', v_payment.livemode, _event_id, 'Refund adjustment'
  );

  RETURN jsonb_build_object('status','adjusted','amount_cents', -v_reduction);
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_apply_dispute(
  _payment_intent_id text,
  _event_id text,
  _livemode boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.affiliate_payments%ROWTYPE;
  v_net integer;
BEGIN
  IF _payment_intent_id IS NULL THEN
    RETURN jsonb_build_object('status','ignored');
  END IF;

  SELECT * INTO v_payment FROM public.affiliate_payments
  WHERE stripe_payment_intent_id = _payment_intent_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.affiliate_pending_adjustments (payment_intent_id, disputed, livemode)
    VALUES (_payment_intent_id, true, _livemode)
    ON CONFLICT (payment_intent_id) DO UPDATE SET disputed = true, updated_at = now();
    RETURN jsonb_build_object('status','pending_payment');
  END IF;

  UPDATE public.affiliate_payments SET disputed = true, updated_at = now() WHERE id = v_payment.id;

  SELECT COALESCE(SUM(amount_cents),0) INTO v_net
  FROM public.affiliate_commissions
  WHERE payment_id = v_payment.id AND entry_type <> 'payout';

  IF v_net <= 0 THEN
    RETURN jsonb_build_object('status','nothing_to_reduce');
  END IF;

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, payment_id, entry_type, amount_cents, currency,
    status, livemode, source_event_id, note
  ) VALUES (
    v_payment.affiliate_id, v_payment.referral_id, v_payment.id, 'dispute', -v_net,
    v_payment.currency, 'verified', v_payment.livemode, _event_id, 'Chargeback adjustment'
  );

  RETURN jsonb_build_object('status','adjusted','amount_cents', -v_net);
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_resolve_dispute(
  _payment_intent_id text,
  _event_id text,
  _livemode boolean,
  _won boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.affiliate_payments%ROWTYPE;
  v_dispute_net integer;
BEGIN
  IF _payment_intent_id IS NULL THEN
    RETURN jsonb_build_object('status','ignored');
  END IF;

  SELECT * INTO v_payment FROM public.affiliate_payments
  WHERE stripe_payment_intent_id = _payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','unknown_payment');
  END IF;

  IF NOT _won THEN
    UPDATE public.affiliate_payments SET disputed = true, updated_at = now() WHERE id = v_payment.id;
    RETURN jsonb_build_object('status','lost_no_change');
  END IF;

  -- Won: put back exactly what the chargeback took off, once.
  SELECT COALESCE(SUM(amount_cents),0) INTO v_dispute_net
  FROM public.affiliate_commissions
  WHERE payment_id = v_payment.id AND entry_type = 'dispute';

  IF v_dispute_net >= 0 THEN
    RETURN jsonb_build_object('status','nothing_to_restore');
  END IF;

  UPDATE public.affiliate_payments SET disputed = false, updated_at = now() WHERE id = v_payment.id;

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referral_id, payment_id, entry_type, amount_cents, currency,
    status, livemode, source_event_id, note
  ) VALUES (
    v_payment.affiliate_id, v_payment.referral_id, v_payment.id, 'dispute', -v_dispute_net,
    v_payment.currency, 'verified', v_payment.livemode, _event_id, 'Chargeback won — adjustment reversed'
  );

  RETURN jsonb_build_object('status','restored','amount_cents', -v_dispute_net);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.affiliate_claim_webhook_event(text,text,boolean,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_complete_webhook_event(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_record_enrollment_payment(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_apply_refund(text,integer,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_apply_dispute(text,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.affiliate_resolve_dispute(text,text,boolean,boolean) FROM PUBLIC, anon, authenticated;