-- Record one Chris SMS for each paid individual system sent to the supplier.
ALTER TABLE public.order_notifications DROP CONSTRAINT order_notifications_channel_check;
ALTER TABLE public.order_notifications ADD CONSTRAINT order_notifications_channel_check
  CHECK (channel IN ('customer_email', 'customer_receipt', 'customer_sms', 'supplier_email', 'crm_sync', 'admin_order_sms'));

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

  IF FOUND THEN RETURN 'claimed'; END IF;

  SELECT * INTO existing FROM public.order_notifications
  WHERE order_id = _order_id AND channel = _channel FOR UPDATE;

  IF existing.status = 'sent' THEN RETURN 'duplicate'; END IF;
  IF _channel IN ('supplier_email', 'admin_order_sms') AND existing.status = 'uncertain' THEN RETURN 'manual_review'; END IF;
  IF existing.status = 'sending' AND existing.updated_at > now() - interval '10 minutes' THEN
    RETURN 'in_progress';
  END IF;
  IF _channel IN ('supplier_email', 'admin_order_sms') AND existing.status = 'sending' THEN
    UPDATE public.order_notifications
    SET status = 'uncertain', reason = 'Prior notification send outcome unknown; manual reconciliation required.'
    WHERE id = existing.id;
    RETURN 'manual_review';
  END IF;

  UPDATE public.order_notifications
  SET status = 'sending', attempts = existing.attempts + 1, event_id = _event_id, reason = NULL
  WHERE id = existing.id;

  RETURN 'claimed';
END;
$$;
