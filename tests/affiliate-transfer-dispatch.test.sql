-- Regression coverage for the automatic affiliate payout queue.
--
-- Everything runs inside one DO block that deliberately raises at the end, so
-- the whole run is rolled back: no queue rows, no ledger entries, no money, no
-- Stripe calls, nothing left behind. The raised message is the test report.
--
-- Covers: test/live separation, hold timing from the verified payment time,
-- concurrent dispatch against a partially refunded balance, stale-worker
-- takeover, a stale worker trying to overwrite a newer claim (the ambiguous
-- "Stripe sent it but the database write failed" path), and automatic recovery
-- of a blocked job once the balance is healthy again.
DO $$
DECLARE
  r text := '';
  v_aff uuid;
  v_pay_live uuid;
  v_c_live uuid;
  v_c_test uuid;
  v_c_two uuid;
  v_t_live uuid;
  v_t_test uuid;
  v_t_two uuid;
  n integer;
  ok boolean;
  v_status text;
  v_kind text;
  v_hold timestamptz;
  v_paid timestamptz := now() - interval '10 days';
BEGIN
  SELECT id INTO v_aff FROM public.affiliates ORDER BY created_at LIMIT 1;
  IF v_aff IS NULL THEN RAISE EXCEPTION 'No affiliate rows to test against'; END IF;

  -- A live payment paid 10 days ago, and its earned commission.
  INSERT INTO public.affiliate_payments (
    affiliate_id, stripe_object_type, stripe_object_id, stripe_payment_intent_id,
    currency, gross_amount_cents, eligible_amount_cents, livemode, paid_at
  ) VALUES (
    v_aff, 'checkout_session', 'cs_disp_' || gen_random_uuid()::text, 'pi_disp_' || gen_random_uuid()::text,
    'usd', 300000, 300000, true, v_paid
  ) RETURNING id INTO v_pay_live;

  INSERT INTO public.affiliate_commissions (affiliate_id, payment_id, entry_type, amount_cents, currency, rate, status, livemode)
  VALUES (v_aff, v_pay_live, 'earned', 60000, 'usd', 0.2, 'verified', true) RETURNING id INTO v_c_live;

  -- A test-mode commission that must never mix with live.
  INSERT INTO public.affiliate_commissions (affiliate_id, entry_type, amount_cents, currency, rate, status, livemode)
  VALUES (v_aff, 'earned', 12345, 'usd', 0.2, 'verified', false) RETURNING id INTO v_c_test;

  ------------------------------------------------------------------
  -- 1. enqueue is mode-scoped and dates the hold from the payment
  ------------------------------------------------------------------
  PERFORM public.affiliate_transfer_enqueue(true, 'after_days', 3, 500);
  SELECT id, hold_basis_at, release_after INTO v_t_live, v_hold, v_hold
  FROM public.affiliate_transfers WHERE commission_id = v_c_live;
  r := r || CASE WHEN v_t_live IS NOT NULL THEN E'\nPASS live commission queued' ELSE E'\nFAIL live commission not queued' END;

  SELECT count(*) INTO n FROM public.affiliate_transfers WHERE commission_id = v_c_test;
  r := r || CASE WHEN n = 0 THEN E'\nPASS test commission stays out of the live queue' ELSE E'\nFAIL test commission leaked into live queue' END;

  SELECT hold_basis_at, release_after INTO v_hold, v_hold FROM public.affiliate_transfers WHERE id = v_t_live;
  SELECT count(*) INTO n FROM public.affiliate_transfers
  WHERE id = v_t_live AND hold_basis_at = v_paid AND release_after = v_paid + interval '3 days';
  r := r || CASE WHEN n = 1 THEN E'\nPASS hold timing uses the verified payment time' ELSE E'\nFAIL hold timing is not based on the payment time' END;

  PERFORM public.affiliate_transfer_enqueue(false, 'on_verified', 0, 500);
  SELECT id INTO v_t_test FROM public.affiliate_transfers WHERE commission_id = v_c_test;
  r := r || CASE WHEN v_t_test IS NOT NULL THEN E'\nPASS test commission queued in test mode only' ELSE E'\nFAIL test commission not queued' END;

  ------------------------------------------------------------------
  -- 2. claim never crosses modes
  ------------------------------------------------------------------
  SELECT count(*) INTO n FROM public.affiliate_transfer_claim('worker-live', true, 300, 25) c WHERE c.id = v_t_test;
  r := r || CASE WHEN n = 0 THEN E'\nPASS a live worker cannot claim a test record' ELSE E'\nFAIL live worker claimed a test record' END;

  SELECT count(*) INTO n FROM public.affiliate_transfer_claim('worker-test', false, 300, 25) c WHERE c.id = v_t_live;
  r := r || CASE WHEN n = 0 THEN E'\nPASS a test worker cannot claim a live record' ELSE E'\nFAIL test worker claimed a live record' END;

  -- reset the claims made above
  UPDATE public.affiliate_transfers SET status = 'queued', locked_at = NULL, locked_by = NULL
  WHERE id IN (v_t_live, v_t_test);

  ------------------------------------------------------------------
  -- 3. concurrent dispatch against a partially refunded balance
  ------------------------------------------------------------------
  -- Second live earning, so the queue holds 60000 + 60000 = 120000 ...
  INSERT INTO public.affiliate_commissions (affiliate_id, entry_type, amount_cents, currency, rate, status, livemode)
  VALUES (v_aff, 'earned', 60000, 'usd', 0.2, 'verified', true) RETURNING id INTO v_c_two;
  -- ... but a refund removes 60000, so only one of the two may go out.
  INSERT INTO public.affiliate_commissions (affiliate_id, entry_type, amount_cents, currency, rate, status, livemode)
  VALUES (v_aff, 'refund', -60000, 'usd', 0.2, 'verified', true);

  PERFORM public.affiliate_transfer_enqueue(true, 'on_verified', 0, 500);
  SELECT id INTO v_t_two FROM public.affiliate_transfers WHERE commission_id = v_c_two;
  UPDATE public.affiliate_transfers SET release_after = now() - interval '1 minute', next_attempt_at = now() - interval '1 minute'
  WHERE id IN (v_t_live, v_t_two);

  -- Ignore anything this affiliate already had queued from earlier real work.
  UPDATE public.affiliate_transfers SET status = 'canceled'
  WHERE affiliate_id = v_aff AND livemode = true AND id NOT IN (v_t_live, v_t_two) AND status IN ('queued','blocked','processing');

  SELECT count(*) INTO n FROM public.affiliate_transfer_claim('worker-a', true, 300, 25);
  r := r || CASE WHEN n = 1 THEN E'\nPASS only the covered amount is reserved (1 of 2 claimed)' ELSE E'\nFAIL reservation claimed ' || n || ' rows' END;

  -- A second worker running at the same time must find nothing payable.
  SELECT count(*) INTO n FROM public.affiliate_transfer_claim('worker-b', true, 300, 25);
  r := r || CASE WHEN n = 0 THEN E'\nPASS a concurrent worker cannot overpay the refunded balance' ELSE E'\nFAIL concurrent worker claimed ' || n || ' rows' END;

  SELECT status, blocked_kind INTO v_status, v_kind FROM public.affiliate_transfers
  WHERE id IN (v_t_live, v_t_two) AND status = 'blocked' LIMIT 1;
  r := r || CASE WHEN v_kind = 'balance' THEN E'\nPASS the uncovered earning is held, not failed' ELSE E'\nFAIL uncovered earning state: ' || COALESCE(v_status,'?') || '/' || COALESCE(v_kind,'?') END;

  SELECT count(*) INTO n FROM public.affiliate_transfers WHERE id IN (v_t_live, v_t_two) AND attempts > 0;
  r := r || CASE WHEN n = 0 THEN E'\nPASS a balance hold burns no retry attempts' ELSE E'\nFAIL balance hold consumed retries' END;

  ------------------------------------------------------------------
  -- 4. release is worker-bound (stale worker cannot overwrite)
  ------------------------------------------------------------------
  SELECT id INTO v_t_two FROM public.affiliate_transfers WHERE status = 'processing' AND locked_by = 'worker-a' LIMIT 1;
  ok := public.affiliate_transfer_release(v_t_two, 'worker-stale', jsonb_build_object('status','failed'));
  r := r || CASE WHEN ok = false THEN E'\nPASS a stale worker cannot overwrite a live claim' ELSE E'\nFAIL stale worker overwrote a claim' END;

  SELECT status INTO v_status FROM public.affiliate_transfers WHERE id = v_t_two;
  r := r || CASE WHEN v_status = 'processing' THEN E'\nPASS the real claim survived the stale write' ELSE E'\nFAIL claim state changed to ' || v_status END;

  ok := public.affiliate_transfer_release(v_t_two, 'worker-a',
        jsonb_build_object('status','sent','stripe_transfer_id','tr_test_fake','sent_at', now()::text));
  r := r || CASE WHEN ok THEN E'\nPASS the holding worker can write its result' ELSE E'\nFAIL holding worker could not write' END;

  -- Ambiguous outcome: Stripe sent it, our write lost the lock. The row is
  -- parked for reconciliation and is never claimed again.
  UPDATE public.affiliate_transfers
  SET needs_reconciliation = true, reconciliation_note = 'sent but not recorded', status = 'queued',
      next_attempt_at = now() - interval '1 minute'
  WHERE id = v_t_two;
  SELECT count(*) INTO n FROM public.affiliate_transfer_claim('worker-c', true, 300, 25) c WHERE c.id = v_t_two;
  r := r || CASE WHEN n = 0 THEN E'\nPASS a row awaiting reconciliation is never re-sent' ELSE E'\nFAIL parked row was claimed again' END;
  UPDATE public.affiliate_transfers SET needs_reconciliation = false, status = 'sent' WHERE id = v_t_two;

  ------------------------------------------------------------------
  -- 5. stale lock takeover
  ------------------------------------------------------------------
  UPDATE public.affiliate_transfers
  SET status = 'processing', locked_by = 'worker-dead', locked_at = now() - interval '2 hours',
      next_attempt_at = now() - interval '1 minute', release_after = now() - interval '1 minute',
      needs_reconciliation = false
  WHERE id = v_t_live;
  -- Put enough verified balance back so the claim is about the lock, not money.
  INSERT INTO public.affiliate_commissions (affiliate_id, entry_type, amount_cents, currency, rate, status, livemode)
  VALUES (v_aff, 'manual', 200000, 'usd', NULL, 'verified', true);

  SELECT count(*) INTO n FROM public.affiliate_transfer_claim('worker-d', true, 300, 25) c WHERE c.id = v_t_live;
  r := r || CASE WHEN n = 1 THEN E'\nPASS an abandoned job is taken over after the lock goes stale' ELSE E'\nFAIL stale lock was not recovered' END;

  ------------------------------------------------------------------
  -- 6. a blocked job resumes on its own once funds are back
  ------------------------------------------------------------------
  PERFORM public.affiliate_transfer_release(v_t_live, 'worker-d',
    jsonb_build_object('status','blocked','blocked_kind','account_not_ready',
                       'failure_message','waiting','next_attempt_at', (now() - interval '1 minute')::text));
  SELECT count(*) INTO n FROM public.affiliate_transfer_claim('worker-e', true, 300, 25) c WHERE c.id = v_t_live;
  r := r || CASE WHEN n = 1 THEN E'\nPASS a blocked job resumes automatically when it is due again' ELSE E'\nFAIL blocked job did not resume' END;

  SELECT count(*) INTO n FROM public.affiliate_transfers WHERE id = v_t_live AND attempts > 0;
  r := r || CASE WHEN n = 0 THEN E'\nPASS account-not-ready holds burn no retry attempts' ELSE E'\nFAIL account hold consumed retries' END;

  RAISE EXCEPTION E'AFFILIATE TRANSFER DISPATCH TEST REPORT%', r;
END;
$$;
