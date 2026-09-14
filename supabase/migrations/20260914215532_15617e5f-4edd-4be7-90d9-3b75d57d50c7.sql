ALTER TABLE public.affiliate_transfers
  ADD COLUMN IF NOT EXISTS needs_reconciliation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciliation_note text,
  ADD COLUMN IF NOT EXISTS transfer_group text,
  ADD COLUMN IF NOT EXISTS hold_basis_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_kind text;

UPDATE public.affiliate_transfers SET transfer_group = idempotency_key WHERE transfer_group IS NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_transfers_dispatch
  ON public.affiliate_transfers (livemode, status, next_attempt_at);

-- Build the queue. Test and live never mix, and the hold clock starts at the
-- authoritative payment time, not when the ledger row happened to be written.
CREATE OR REPLACE FUNCTION public.affiliate_transfer_enqueue(
  _livemode boolean,
  _release_timing text,
  _delay_days integer,
  _limit integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_delay interval := make_interval(days => CASE WHEN _release_timing = 'after_days' THEN COALESCE(_delay_days, 0) ELSE 0 END);
BEGIN
  WITH candidate AS (
    SELECT c.id, c.affiliate_id, c.amount_cents, c.currency, c.livemode,
           COALESCE(p.paid_at, c.created_at) AS basis_at
    FROM public.affiliate_commissions c
    LEFT JOIN public.affiliate_payments p ON p.id = c.payment_id
    LEFT JOIN public.affiliate_transfers t ON t.commission_id = c.id
    WHERE c.entry_type = 'earned'
      AND c.status = 'verified'
      AND c.livemode = _livemode
      AND c.amount_cents > 0
      AND t.id IS NULL
    ORDER BY c.created_at
    LIMIT GREATEST(1, COALESCE(_limit, 200))
  ), ins AS (
    INSERT INTO public.affiliate_transfers (
      affiliate_id, commission_id, amount_cents, currency, idempotency_key,
      transfer_group, hold_basis_at, release_after, next_attempt_at, livemode
    )
    SELECT affiliate_id, id, amount_cents, lower(currency), 'aff_tr_' || id::text,
           'aff_tr_' || id::text, basis_at, basis_at + v_delay, basis_at + v_delay, livemode
    FROM candidate
    ON CONFLICT (commission_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;
  RETURN v_count;
END;
$$;

-- Atomic claim with balance reservation, per affiliate + currency + mode.
CREATE OR REPLACE FUNCTION public.affiliate_transfer_claim(
  _worker text,
  _livemode boolean,
  _stale_seconds integer DEFAULT 300,
  _limit integer DEFAULT 25
)
RETURNS SETOF public.affiliate_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v public.affiliate_transfers%ROWTYPE;
  v_stale timestamptz := now() - make_interval(secs => GREATEST(30, COALESCE(_stale_seconds, 300)));
  v_net bigint;
  v_committed bigint;
  v_available bigint;
  v_taken integer := 0;
BEGIN
  IF _worker IS NULL OR length(_worker) = 0 THEN
    RAISE EXCEPTION 'A worker id is required';
  END IF;

  FOR v IN
    SELECT * FROM public.affiliate_transfers t
    WHERE t.livemode = _livemode
      AND t.needs_reconciliation = false
      AND t.status IN ('queued', 'blocked', 'processing')
      AND (t.status <> 'processing' OR t.locked_at IS NULL OR t.locked_at <= v_stale)
      AND t.next_attempt_at <= now()
      AND t.release_after <= now()
    ORDER BY t.created_at
    LIMIT GREATEST(1, COALESCE(_limit, 25)) * 4
  LOOP
    EXIT WHEN v_taken >= GREATEST(1, COALESCE(_limit, 25));

    -- Serialize every balance decision for this affiliate/currency/mode.
    PERFORM pg_advisory_xact_lock(
      hashtext(v.affiliate_id::text || ':' || lower(v.currency) || ':' || v.livemode::text)
    );

    SELECT * INTO v FROM public.affiliate_transfers WHERE id = v.id FOR UPDATE;
    CONTINUE WHEN v.needs_reconciliation
      OR v.status NOT IN ('queued', 'blocked', 'processing')
      OR v.next_attempt_at > now()
      OR v.release_after > now()
      OR (v.status = 'processing' AND v.locked_at IS NOT NULL AND v.locked_at > v_stale);

    SELECT COALESCE(sum(c.amount_cents), 0) INTO v_net
    FROM public.affiliate_commissions c
    WHERE c.affiliate_id = v.affiliate_id
      AND c.livemode = v.livemode
      AND lower(c.currency) = lower(v.currency)
      AND c.status = 'verified'
      AND c.entry_type <> 'payout';

    -- Money already gone plus money reserved by other workers right now.
    SELECT COALESCE(sum(t.amount_cents), 0) INTO v_committed
    FROM public.affiliate_transfers t
    WHERE t.affiliate_id = v.affiliate_id
      AND t.livemode = v.livemode
      AND lower(t.currency) = lower(v.currency)
      AND t.id <> v.id
      AND (
        t.status IN ('sent', 'paid')
        OR t.needs_reconciliation
        OR (t.status = 'processing' AND t.locked_at IS NOT NULL AND t.locked_at > v_stale)
      );

    v_available := v_net - v_committed;

    IF v_available < v.amount_cents THEN
      -- A partial refund holds back only what is not covered; the rest stays
      -- payable and this row is retried automatically, never failed.
      UPDATE public.affiliate_transfers
      SET status = 'blocked',
          blocked_kind = 'balance',
          locked_at = NULL,
          locked_by = NULL,
          failure_message = 'Waiting: the balance owed is lower than this commission (refund or chargeback adjustment).',
          next_attempt_at = now() + interval '30 minutes'
      WHERE id = v.id;
      CONTINUE;
    END IF;

    UPDATE public.affiliate_transfers
    SET status = 'processing',
        blocked_kind = NULL,
        locked_at = now(),
        locked_by = _worker
    WHERE id = v.id
    RETURNING * INTO v;

    v_taken := v_taken + 1;
    RETURN NEXT v;
  END LOOP;
  RETURN;
END;
$$;

-- Only the worker that holds the row may write to it.
CREATE OR REPLACE FUNCTION public.affiliate_transfer_release(
  _id uuid,
  _worker text,
  _patch jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.affiliate_transfers t
  SET status = COALESCE(_patch->>'status', t.status),
      attempts = COALESCE((_patch->>'attempts')::integer, t.attempts),
      blocked_kind = CASE WHEN _patch ? 'blocked_kind' THEN NULLIF(_patch->>'blocked_kind','') ELSE t.blocked_kind END,
      failure_message = CASE WHEN _patch ? 'failure_message' THEN NULLIF(_patch->>'failure_message','') ELSE t.failure_message END,
      failure_code = CASE WHEN _patch ? 'failure_code' THEN NULLIF(_patch->>'failure_code','') ELSE t.failure_code END,
      next_attempt_at = COALESCE((_patch->>'next_attempt_at')::timestamptz, t.next_attempt_at),
      destination_account_id = COALESCE(NULLIF(_patch->>'destination_account_id',''), t.destination_account_id),
      stripe_transfer_id = COALESCE(NULLIF(_patch->>'stripe_transfer_id',''), t.stripe_transfer_id),
      stripe_destination_payment_id = COALESCE(NULLIF(_patch->>'stripe_destination_payment_id',''), t.stripe_destination_payment_id),
      sent_at = COALESCE((_patch->>'sent_at')::timestamptz, t.sent_at),
      needs_reconciliation = COALESCE((_patch->>'needs_reconciliation')::boolean, t.needs_reconciliation),
      reconciliation_note = CASE WHEN _patch ? 'reconciliation_note' THEN NULLIF(_patch->>'reconciliation_note','') ELSE t.reconciliation_note END,
      locked_at = NULL,
      locked_by = NULL
  WHERE t.id = _id
    AND t.locked_by = _worker;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.affiliate_transfer_enqueue(boolean, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.affiliate_transfer_claim(text, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.affiliate_transfer_release(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_transfer_enqueue(boolean, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_transfer_claim(text, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_transfer_release(uuid, text, jsonb) TO service_role;