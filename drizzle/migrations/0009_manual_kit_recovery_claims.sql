-- Permanent one-send claim for admin-entered kits. The request UUID supports
-- transport retries; identity and order indexes also block a fresh UUID.
CREATE TABLE public.hair_system_kit_manual_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL UNIQUE,
  identity_key text NOT NULL UNIQUE,
  admin_id uuid NOT NULL,
  preview_facts jsonb NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'sent', 'uncertain')),
  supplier_order_id uuid REFERENCES public.orders(id),
  supplier_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.hair_system_kit_manual_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hair_system_kit_manual_recoveries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hair_system_kit_manual_recoveries TO service_role;

-- A manual entry is identified by its own stable key, never a fabricated GHL order.
ALTER TABLE public.hair_system_kit_deliveries ALTER COLUMN ghl_order_id DROP NOT NULL;
ALTER TABLE public.hair_system_kit_deliveries ADD COLUMN entitlement_key text;
ALTER TABLE public.hair_system_kit_deliveries ADD CONSTRAINT kit_delivery_exactly_one_identity
  CHECK ((ghl_order_id IS NOT NULL) <> (entitlement_key IS NOT NULL));
CREATE UNIQUE INDEX hair_system_kit_delivery_entitlement_unique
  ON public.hair_system_kit_deliveries (location_id, entitlement_key) WHERE entitlement_key IS NOT NULL;

-- Covers old and new supplier kits, including automatic and manual routes.
-- Existing duplicate rows must be reconciled before this migration can apply.
CREATE UNIQUE INDEX orders_supplier_kit_email_unique
  ON public.orders (lower(btrim(customer_email)))
  WHERE (order_details->>'supplier_kit' = 'true' OR order_details->>'kit_order' = 'true') AND btrim(customer_email) <> '';
CREATE UNIQUE INDEX orders_supplier_kit_phone_unique
  ON public.orders (regexp_replace(coalesce(order_details->>'phone', ''), '[^0-9]', '', 'g'))
  WHERE (order_details->>'supplier_kit' = 'true' OR order_details->>'kit_order' = 'true') AND
    regexp_replace(coalesce(order_details->>'phone', ''), '[^0-9]', '', 'g') <> '';

-- Complete database-side duplicate lookup; PostgREST row limits cannot hide
-- legacy or archived kits. Supplier notification/delivery counts are included.
CREATE FUNCTION public.manual_kit_duplicate_state(_email text, _phone text, _name text,
  _address1 text, _postal_code text, _request_key uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH matching AS (
    SELECT o.id FROM public.orders o
    WHERE (o.order_details->>'supplier_kit' = 'true' OR o.order_details->>'kit_order' = 'true')
      AND (
        lower(btrim(o.customer_email)) = lower(btrim(_email)) OR
        (regexp_replace(coalesce(o.order_details->>'phone',''), '[^0-9]', '', 'g') <> '' AND
         regexp_replace(o.order_details->>'phone', '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')) OR
        o.external_order_id = 'manual-kit:' || _request_key::text OR
        (lower(btrim(coalesce(o.customer_name,''))) = lower(btrim(_name)) AND
         lower(btrim(coalesce(o.order_details->'shipping_address'->>'address1',
           o.order_details->'shipping_address'->>'address_1',''))) = lower(btrim(_address1)) AND
         btrim(coalesce(o.order_details->'shipping_address'->>'postal_code',
           o.order_details->'shipping_address'->>'zip','')) = btrim(_postal_code))
      )
  )
  SELECT jsonb_build_object(
    'matching_orders', (SELECT count(*) FROM matching),
    'supplier_notifications', (SELECT count(*) FROM public.order_notifications n JOIN matching m ON m.id = n.order_id WHERE n.channel = 'supplier_email'),
    'delivery_records', (SELECT count(*) FROM public.hair_system_kit_deliveries d JOIN matching m ON m.id = d.order_id)
  );
$$;
REVOKE ALL ON FUNCTION public.manual_kit_duplicate_state(text,text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manual_kit_duplicate_state(text,text,text,text,text,uuid) TO service_role;

-- Automated upserts/reconciliations cannot replace admin-entered facts or
-- strip the source marker. Supplier status/tracking changes remain allowed.
CREATE FUNCTION public.protect_manual_kit_facts() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.order_details->>'manual_source' = 'admin_entry' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Manual kit records cannot be deleted or overwritten.';
    END IF;
    IF NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
       NEW.customer_email IS DISTINCT FROM OLD.customer_email OR
       NEW.external_order_id IS DISTINCT FROM OLD.external_order_id OR
       NEW.payment_reference IS DISTINCT FROM OLD.payment_reference OR
       NEW.order_date IS DISTINCT FROM OLD.order_date OR
       NEW.user_id IS DISTINCT FROM OLD.user_id OR
       NEW.order_details->>'manual_source' IS DISTINCT FROM OLD.order_details->>'manual_source' OR
       NEW.order_details->>'supplier_kit' IS DISTINCT FROM OLD.order_details->>'supplier_kit' OR
       NEW.order_details->'manual_facts' IS DISTINCT FROM OLD.order_details->'manual_facts' OR
       NEW.order_details->>'manual_identity_key' IS DISTINCT FROM OLD.order_details->>'manual_identity_key' OR
       NEW.order_details->>'manual_request_key' IS DISTINCT FROM OLD.order_details->>'manual_request_key' OR
       NEW.order_details->>'manual_admin_id' IS DISTINCT FROM OLD.order_details->>'manual_admin_id' OR
       NEW.order_details->>'full_name' IS DISTINCT FROM OLD.order_details->>'full_name' OR
       NEW.order_details->>'phone' IS DISTINCT FROM OLD.order_details->>'phone' OR
       NEW.order_details->'shipping_address' IS DISTINCT FROM OLD.order_details->'shipping_address' OR
       NEW.order_details->>'kit_notes' IS DISTINCT FROM OLD.order_details->>'kit_notes' OR
       NEW.order_details->>'notes' IS DISTINCT FROM OLD.order_details->>'notes' OR
       NEW.order_details->'order' IS DISTINCT FROM OLD.order_details->'order' THEN
      RAISE EXCEPTION 'Manual kit facts are immutable.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_manual_kit_facts() FROM PUBLIC;
CREATE TRIGGER protect_manual_kit_facts_before_write
  BEFORE UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_manual_kit_facts();
