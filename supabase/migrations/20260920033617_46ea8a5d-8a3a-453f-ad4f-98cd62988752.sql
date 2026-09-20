
-- Idempotent record of processed Stripe payment events for hair system orders
CREATE TABLE public.hair_system_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'processing',
  payload_digest text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT ON public.hair_system_webhook_events TO authenticated;
GRANT ALL ON public.hair_system_webhook_events TO service_role;
ALTER TABLE public.hair_system_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view hair system webhook events"
  ON public.hair_system_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Per-order, per-channel delivery log
CREATE TABLE public.order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('customer_email','customer_sms','supplier_email')),
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','skipped')),
  provider text NOT NULL DEFAULT 'ghl',
  provider_message_id text,
  recipient_hint text,
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, channel)
);

GRANT SELECT ON public.order_notifications TO authenticated;
GRANT ALL ON public.order_notifications TO service_role;
ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view order notifications"
  ON public.order_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_order_notifications_updated_at
  BEFORE UPDATE ON public.order_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic claim for a payment event: 'claimed' | 'duplicate' | 'in_progress'
CREATE OR REPLACE FUNCTION public.hair_system_claim_webhook_event(
  _event_id text, _event_type text, _livemode boolean, _digest text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_status text;
BEGIN
  INSERT INTO public.hair_system_webhook_events (event_id, event_type, livemode, payload_digest)
  VALUES (_event_id, _event_type, COALESCE(_livemode, true), _digest)
  ON CONFLICT (event_id) DO NOTHING;

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT status INTO existing_status
  FROM public.hair_system_webhook_events WHERE event_id = _event_id;

  IF existing_status = 'done' THEN
    RETURN 'duplicate';
  END IF;

  -- Stale processing rows may be retried after 10 minutes.
  UPDATE public.hair_system_webhook_events
  SET status = 'processing', created_at = now()
  WHERE event_id = _event_id AND created_at < now() - interval '10 minutes';

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  RETURN 'in_progress';
END;
$$;

-- Atomic per-channel claim: 'claimed' | 'duplicate' | 'in_progress'
CREATE OR REPLACE FUNCTION public.claim_order_notification(
  _order_id uuid, _channel text, _event_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.order_notifications%ROWTYPE;
BEGIN
  INSERT INTO public.order_notifications (order_id, channel, status, attempts, event_id)
  VALUES (_order_id, _channel, 'sending', 1, _event_id)
  ON CONFLICT (order_id, channel) DO NOTHING;

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT * INTO existing FROM public.order_notifications
  WHERE order_id = _order_id AND channel = _channel FOR UPDATE;

  IF existing.status = 'sent' THEN
    RETURN 'duplicate';
  END IF;

  IF existing.status = 'sending' AND existing.updated_at > now() - interval '10 minutes' THEN
    RETURN 'in_progress';
  END IF;

  UPDATE public.order_notifications
  SET status = 'sending', attempts = existing.attempts + 1, event_id = _event_id, reason = NULL
  WHERE id = existing.id;

  RETURN 'claimed';
END;
$$;
