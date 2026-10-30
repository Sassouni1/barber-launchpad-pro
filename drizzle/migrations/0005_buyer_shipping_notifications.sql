-- Buyer shipping notifications: queued only by FUTURE tracking saves (no backfill).
CREATE TABLE public.buyer_shipping_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retry','claimed','done','suppressed')),
  new_keys text[] NOT NULL DEFAULT '{}',
  due_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX buyer_shipping_notifications_one_pending ON public.buyer_shipping_notifications(order_id) WHERE status = 'pending';
CREATE INDEX buyer_shipping_notifications_due ON public.buyer_shipping_notifications(due_at) WHERE status IN ('pending','retry','claimed');

CREATE TABLE public.buyer_shipping_notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.buyer_shipping_notifications(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  status text NOT NULL CHECK (status IN ('sending','sent','skipped','retry','failed','uncertain')),
  tracking_keys text[] NOT NULL DEFAULT '{}',
  recipient_hint text,
  provider_message_id text,
  reason text,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);
CREATE INDEX buyer_shipping_notification_channels_order ON public.buyer_shipping_notification_channels(order_id, channel);

GRANT ALL ON public.buyer_shipping_notifications TO service_role;
GRANT ALL ON public.buyer_shipping_notification_channels TO service_role;
GRANT SELECT ON public.buyer_shipping_notifications TO authenticated;
GRANT SELECT ON public.buyer_shipping_notification_channels TO authenticated;
ALTER TABLE public.buyer_shipping_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_shipping_notification_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read buyer shipping notifications" ON public.buyer_shipping_notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read buyer shipping channels" ON public.buyer_shipping_notification_channels FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Normalized active tracking keys (primary + additional packages), matching numberKey().
CREATE OR REPLACE FUNCTION public.order_tracking_keys(_primary text, _details jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT k) FILTER (WHERE k <> ''), '{}') FROM (
    SELECT upper(regexp_replace(coalesce(_primary, ''), '[ -]', '', 'g')) AS k
    UNION ALL
    SELECT upper(regexp_replace(coalesce(e->>'tracking_number', ''), '[ -]', '', 'g'))
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_details->'supplier_additional_tracking') = 'array' THEN _details->'supplier_additional_tracking' ELSE '[]'::jsonb END) e
  ) s
$$;

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
  -- Coalesce: saves inside the same window join the pending row and keep its due time.
  INSERT INTO public.buyer_shipping_notifications(order_id, new_keys)
  VALUES (NEW.id, added)
  ON CONFLICT (order_id) WHERE status = 'pending'
  DO UPDATE SET new_keys = (SELECT array_agg(DISTINCT x) FROM unnest(buyer_shipping_notifications.new_keys || EXCLUDED.new_keys) x), updated_at = now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_buyer_shipping_notification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_buyer_shipping_notification AFTER UPDATE OF tracking_number, order_details ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_buyer_shipping_notification();

-- Atomic claim of due rows; stale claims (crashed worker) are reclaimable, channel rows prevent re-sends.
CREATE OR REPLACE FUNCTION public.claim_buyer_shipping_notifications(_limit integer DEFAULT 20)
RETURNS SETOF public.buyer_shipping_notifications LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.buyer_shipping_notifications n SET status = 'claimed', claimed_at = now(), attempts = n.attempts + 1, updated_at = now()
  WHERE n.id IN (
    SELECT id FROM public.buyer_shipping_notifications
    WHERE (status IN ('pending','retry') AND due_at <= now()) OR (status = 'claimed' AND claimed_at < now() - interval '10 minutes')
    ORDER BY due_at LIMIT greatest(1, least(_limit, 50)) FOR UPDATE SKIP LOCKED)
  RETURNING n.*
$$;
REVOKE ALL ON FUNCTION public.claim_buyer_shipping_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_buyer_shipping_notifications(integer) TO service_role;