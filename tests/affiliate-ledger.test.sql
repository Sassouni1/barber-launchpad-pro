-- Regression coverage for the affiliate webhook ledger functions.
--
-- Everything runs inside one DO block that deliberately raises at the end, so
-- the whole run is rolled back: no rows, no ledger entries, no money, nothing
-- left behind. The raised message is the test report.
--
-- Covers: retry after a failed delivery, duplicate/in-progress claims, two
-- distinct completion events for one paid checkout, repeated and escalating
-- refunds, a refund that arrives before the sale is recorded, a chargeback and
-- its reversal, and test-mode isolation from live payouts.
DO $$
DECLARE
  r text := '';
  v_aff uuid;
  v_ref uuid;
  v_pay uuid;
  v_res jsonb;
  v_claim text;
  v_int text := 'pi_test_' || gen_random_uuid()::text;
  v_int2 text := 'pi_test_' || gen_random_uuid()::text;
  v_sess text := 'cs_test_' || gen_random_uuid()::text;
  v_sess2 text := 'cs_test_' || gen_random_uuid()::text;
  v_ev text := 'evt_test_' || gen_random_uuid()::text;
  n integer;
  net integer;

BEGIN
  -- helper: append a PASS/FAIL line
  -- (inline, since DO blocks cannot declare functions)

  ------------------------------------------------------------------
  -- fixtures
  ------------------------------------------------------------------
  SELECT id INTO v_aff FROM public.affiliates ORDER BY created_at LIMIT 1;
  IF v_aff IS NULL THEN
    RAISE EXCEPTION 'No affiliate rows to test against';
  END IF;

  INSERT INTO public.affiliate_referrals (affiliate_id, link_type, lead_email, lead_email_normalized, token_hash, first_seen_at)
  VALUES (v_aff, 'pay', 'ledger-test@example.com', 'ledger-test@example.com', gen_random_uuid()::text, now() - interval '2 days')
  RETURNING id INTO v_ref;

  ------------------------------------------------------------------
  -- 1. claim: new -> in_progress -> failed retry -> completed -> duplicate
  ------------------------------------------------------------------
  v_claim := public.affiliate_claim_webhook_event(v_ev, 'checkout.session.completed', false, 'digest');
  r := r || CASE WHEN v_claim = 'claimed' THEN E'\nPASS first claim' ELSE E'\nFAIL first claim: ' || v_claim END;

  v_claim := public.affiliate_claim_webhook_event(v_ev, 'checkout.session.completed', false, 'digest');
  r := r || CASE WHEN v_claim = 'in_progress' THEN E'\nPASS concurrent delivery is held off' ELSE E'\nFAIL concurrent: ' || v_claim END;

  PERFORM public.affiliate_complete_webhook_event(v_ev, 'failed', 'boom');
  v_claim := public.affiliate_claim_webhook_event(v_ev, 'checkout.session.completed', false, 'digest');
  r := r || CASE WHEN v_claim = 'claimed' THEN E'\nPASS retry after failure is processed again' ELSE E'\nFAIL retry after failure: ' || v_claim END;

  PERFORM public.affiliate_complete_webhook_event(v_ev, 'completed', NULL);
  v_claim := public.affiliate_claim_webhook_event(v_ev, 'checkout.session.completed', false, 'digest');
  r := r || CASE WHEN v_claim = 'duplicate' THEN E'\nPASS completed delivery is a duplicate' ELSE E'\nFAIL duplicate: ' || v_claim END;

  ------------------------------------------------------------------
  -- 2. two distinct completion events for the same paid checkout
  ------------------------------------------------------------------
  v_res := public.affiliate_record_enrollment_payment(jsonb_build_object(
    'referral_id', v_ref, 'affiliate_id', v_aff,
    'stripe_object_type', 'checkout.session', 'stripe_object_id', v_sess,
    'stripe_payment_intent_id', v_int, 'currency', 'usd',
    'gross_amount_cents', 300000, 'eligible_amount_cents', 300000,
    'livemode', false, 'paid_at', now()::text, 'rate', 0.2, 'accrue', true,
    'source_event_id', 'evt_a'));
  v_pay := (v_res->>'payment_id')::uuid;
  r := r || CASE WHEN (v_res->>'accrued')::boolean AND (v_res->>'amount_cents')::int = 60000
            THEN E'\nPASS first completion earns $600' ELSE E'\nFAIL first completion: ' || v_res::text END;

  v_res := public.affiliate_record_enrollment_payment(jsonb_build_object(
    'referral_id', v_ref, 'affiliate_id', v_aff,
    'stripe_object_type', 'checkout.session', 'stripe_object_id', v_sess,
    'stripe_payment_intent_id', v_int, 'currency', 'usd',
    'gross_amount_cents', 300000, 'eligible_amount_cents', 300000,
    'livemode', false, 'paid_at', now()::text, 'rate', 0.2, 'accrue', true,
    'source_event_id', 'evt_b'));
  SELECT count(*) INTO n FROM public.affiliate_commissions WHERE payment_id = v_pay AND entry_type = 'earned';
  r := r || CASE WHEN n = 1 THEN E'\nPASS a second completion event cannot earn twice'
            ELSE E'\nFAIL duplicate earning, rows=' || n END;

  ------------------------------------------------------------------
  -- 3. repeated and escalating refunds
  ------------------------------------------------------------------
  v_res := public.affiliate_apply_refund(v_int, 150000, 'evt_r1', false);
  r := r || CASE WHEN (v_res->>'amount_cents')::int = -30000 THEN E'\nPASS half refund removes $300'
            ELSE E'\nFAIL half refund: ' || v_res::text END;

  v_res := public.affiliate_apply_refund(v_int, 150000, 'evt_r1_again', false);
  r := r || CASE WHEN v_res->>'status' = 'already_applied' THEN E'\nPASS repeated refund event changes nothing'
            ELSE E'\nFAIL repeated refund: ' || v_res::text END;

  v_res := public.affiliate_apply_refund(v_int, 300000, 'evt_r2', false);
  SELECT COALESCE(SUM(amount_cents),0) INTO net FROM public.affiliate_commissions
  WHERE payment_id = v_pay AND entry_type <> 'payout';
  r := r || CASE WHEN net = 0 THEN E'\nPASS full refund leaves nothing owed'
            ELSE E'\nFAIL full refund net=' || net END;

  ------------------------------------------------------------------
  -- 4. refund that arrives BEFORE the sale is recorded
  ------------------------------------------------------------------
  v_res := public.affiliate_apply_refund(v_int2, 300000, 'evt_early_refund', false);
  r := r || CASE WHEN v_res->>'status' = 'pending_payment' THEN E'\nPASS early refund is remembered'
            ELSE E'\nFAIL early refund: ' || v_res::text END;

  v_res := public.affiliate_record_enrollment_payment(jsonb_build_object(
    'referral_id', v_ref, 'affiliate_id', v_aff,
    'stripe_object_type', 'checkout.session', 'stripe_object_id', v_sess2,
    'stripe_payment_intent_id', v_int2, 'currency', 'usd',
    'gross_amount_cents', 300000, 'eligible_amount_cents', 300000,
    'livemode', false, 'paid_at', now()::text, 'rate', 0.2, 'accrue', true,
    'source_event_id', 'evt_late_sale'));
  SELECT COALESCE(SUM(amount_cents),0) INTO net FROM public.affiliate_commissions
  WHERE payment_id = (v_res->>'payment_id')::uuid AND entry_type <> 'payout';
  r := r || CASE WHEN net = 0 THEN E'\nPASS a sale refunded before accrual owes nothing'
            ELSE E'\nFAIL refund-before-accrual net=' || net END;

  ------------------------------------------------------------------
  -- 5. chargeback and chargeback won
  ------------------------------------------------------------------
  v_res := public.affiliate_apply_refund(v_int, 0, 'noop', false); -- no-op guard
  PERFORM public.affiliate_record_enrollment_payment(jsonb_build_object(
    'referral_id', v_ref, 'affiliate_id', v_aff,
    'stripe_object_type', 'checkout.session', 'stripe_object_id', 'cs_dispute_' || v_sess,
    'stripe_payment_intent_id', 'pi_dispute_' || v_int, 'currency', 'usd',
    'gross_amount_cents', 300000, 'eligible_amount_cents', 300000,
    'livemode', false, 'paid_at', now()::text, 'rate', 0.2, 'accrue', true,
    'source_event_id', 'evt_dispute_sale'));

  v_res := public.affiliate_apply_dispute('pi_dispute_' || v_int, 'evt_d1', false);
  r := r || CASE WHEN (v_res->>'amount_cents')::int = -60000 THEN E'\nPASS chargeback removes the commission'
            ELSE E'\nFAIL chargeback: ' || v_res::text END;

  v_res := public.affiliate_apply_dispute('pi_dispute_' || v_int, 'evt_d1_repeat', false);
  r := r || CASE WHEN v_res->>'status' = 'nothing_to_reduce' THEN E'\nPASS repeated chargeback does not double-reduce'
            ELSE E'\nFAIL repeated chargeback: ' || v_res::text END;

  v_res := public.affiliate_resolve_dispute('pi_dispute_' || v_int, 'evt_d2', false, true);
  SELECT COALESCE(SUM(amount_cents),0) INTO net FROM public.affiliate_commissions c
  JOIN public.affiliate_payments p ON p.id = c.payment_id
  WHERE p.stripe_payment_intent_id = 'pi_dispute_' || v_int AND c.entry_type <> 'payout';
  r := r || CASE WHEN net = 60000 THEN E'\nPASS a chargeback won restores the commission exactly once'
            ELSE E'\nFAIL chargeback won net=' || net END;

  ------------------------------------------------------------------
  -- 6. test mode never enters live payouts
  ------------------------------------------------------------------
  SELECT count(*) INTO n FROM public.affiliate_commissions
  WHERE payment_id = v_pay AND livemode = true;
  r := r || CASE WHEN n = 0 THEN E'\nPASS test-mode events stay out of live balances'
            ELSE E'\nFAIL live rows from test event=' || n END;

  RAISE EXCEPTION 'AFFILIATE LEDGER TEST REPORT%', r;
END;
$$;
