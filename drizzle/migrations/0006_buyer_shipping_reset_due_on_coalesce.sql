CREATE OR REPLACE FUNCTION public.enqueue_buyer_shipping_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE added text[];
BEGIN
  IF NEW.tracking_number IS NULL OR NEW.status = 'pending_payment'
     OR coalesce(NEW.order_details->>'live_verification_test', '') = 'true' THEN RETURN NEW; END IF;
  SELECT coalesce(array_agg(k), '{}') INTO added
  FROM unnest(public.order_tracking_keys(NEW.tracking_number, NEW.order_details)) k
  WHERE k <> ALL (public.order_tracking_keys(OLD.tracking_number, OLD.order_details));
  IF cardinality(added) = 0 THEN RETURN NEW; END IF;
  -- Coalesce: a new distinct key joins the pending row and restarts the 10-minute delay from this save.
  INSERT INTO public.buyer_shipping_notifications(order_id, new_keys)
  VALUES (NEW.id, added)
  ON CONFLICT (order_id) WHERE status = 'pending'
  DO UPDATE SET new_keys = (SELECT array_agg(DISTINCT x) FROM unnest(buyer_shipping_notifications.new_keys || EXCLUDED.new_keys) x),
                due_at = now() + interval '10 minutes',
                updated_at = now();
  RETURN NEW;
END $$;