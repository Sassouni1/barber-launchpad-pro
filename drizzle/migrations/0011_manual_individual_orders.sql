-- Separate one-send claims for individually entered hair systems. Kits retain
-- their existing person-level reservations and indexes.
CREATE TABLE public.hair_system_manual_individual_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL UNIQUE,
  fingerprint text NOT NULL,
  repeat_of_order_id uuid REFERENCES public.orders(id),
  admin_id uuid NOT NULL,
  preview_facts jsonb NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','sent','uncertain')),
  supplier_order_id uuid REFERENCES public.orders(id),
  supplier_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX manual_individual_first_claim_unique ON public.hair_system_manual_individual_claims (fingerprint)
  WHERE repeat_of_order_id IS NULL;
CREATE UNIQUE INDEX manual_individual_repeat_claim_unique ON public.hair_system_manual_individual_claims (repeat_of_order_id)
  WHERE repeat_of_order_id IS NOT NULL;
CREATE UNIQUE INDEX manual_individual_order_request_unique ON public.orders ((order_details->>'manual_request_key'))
  WHERE order_details->>'manual_individual' = 'true';
ALTER TABLE public.hair_system_manual_individual_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hair_system_manual_individual_claims FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hair_system_manual_individual_claims TO service_role;

-- Counts are computed in the database, avoiding PostgREST result limits.
-- A deliberate repeat must reference the most recent sent individual order
-- with the same exact intent, and each parent can have only one child.
CREATE FUNCTION public.manual_individual_duplicate_state(_fingerprint text, _request_key uuid,
  _repeat_of uuid, _name text, _address1 text, _postal_code text, _variant text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  WITH parent AS (
    SELECT o.id, o.order_date FROM public.orders o
    JOIN public.hair_system_manual_individual_claims c ON c.supplier_order_id = o.id AND c.status = 'sent'
    JOIN public.hair_system_kit_deliveries d ON d.order_id = o.id AND d.status = 'sent'
    WHERE o.id = _repeat_of AND o.order_details->>'manual_individual' = 'true'
      AND o.order_details->>'manual_identity_key' = _fingerprint
  ), prior AS (
    SELECT o.id FROM public.orders o
    WHERE o.order_details->>'manual_individual' = 'true'
      AND o.order_details->>'manual_identity_key' = _fingerprint
      AND (_repeat_of IS NULL OR (o.id <> _repeat_of AND
        (o.order_date, o.id) > (COALESCE((SELECT order_date FROM parent), '-infinity'::timestamptz), _repeat_of)))
  ), external_matching AS (
    SELECT o.id FROM public.orders o
    WHERE o.order_details->>'manual_individual' IS DISTINCT FROM 'true'
      AND o.order_details->>'supplier_kit' IS DISTINCT FROM 'true'
      AND o.order_details->>'kit_order' IS DISTINCT FROM 'true'
      AND lower(btrim(coalesce(o.customer_name,''))) = lower(btrim(_name))
      AND lower(btrim(coalesce(o.order_details->'shipping_address'->>'address1',
        o.order_details->'shipping_address'->>'address_1', o.order_details->'shipping'->>'address1',
        o.order_details->'shipping'->>'address_1',''))) = lower(btrim(_address1))
      AND btrim(coalesce(o.order_details->'shipping_address'->>'postal_code',
        o.order_details->'shipping_address'->>'zip', o.order_details->'shipping'->>'postal_code',
        o.order_details->'shipping'->>'zip','')) = btrim(_postal_code)
      AND lower(btrim(coalesce(o.order_details->>'Choose Color',''))) = lower(btrim(_variant))
  )
  SELECT jsonb_build_object(
    'parent_valid', _repeat_of IS NULL OR EXISTS(SELECT 1 FROM parent),
    'prior_orders', (SELECT count(*) FROM prior),
    'external_orders', (SELECT count(*) FROM external_matching),
    'matching_claims', (SELECT count(*) FROM public.hair_system_manual_individual_claims c
      WHERE c.request_key <> _request_key AND c.fingerprint = _fingerprint
        AND (c.repeat_of_order_id IS NOT DISTINCT FROM _repeat_of)),
    'matching_deliveries', (SELECT count(*) FROM public.hair_system_kit_deliveries d JOIN prior p ON p.id = d.order_id),
    'matching_notifications', (SELECT count(*) FROM public.order_notifications n
      JOIN prior p ON p.id = n.order_id WHERE n.channel = 'supplier_email')
  );
$$;
REVOKE ALL ON FUNCTION public.manual_individual_duplicate_state(text,uuid,uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manual_individual_duplicate_state(text,uuid,uuid,text,text,text,text) TO service_role;

-- The existing manual trigger protects common facts. This adds individual
-- variant, quantity, designation and cost protection, while leaving tracking
-- and supplier progress fields editable.
CREATE FUNCTION public.protect_manual_individual_facts() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.order_details->>'manual_individual' = 'true' THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Manual individual order cannot be deleted.'; END IF;
    IF NEW.order_details->>'manual_individual' IS DISTINCT FROM OLD.order_details->>'manual_individual' OR
       NEW.order_details->>'individual_item' IS DISTINCT FROM OLD.order_details->>'individual_item' OR
       NEW.order_details->>'individual_variant' IS DISTINCT FROM OLD.order_details->>'individual_variant' OR
       NEW.order_details->>'quantity' IS DISTINCT FROM OLD.order_details->>'quantity' OR
       NEW.order_details->>'manual_supplier_cost_cents' IS DISTINCT FROM OLD.order_details->>'manual_supplier_cost_cents' OR
       NEW.order_details->>'Lace or Skin' IS DISTINCT FROM OLD.order_details->>'Lace or Skin' OR
       NEW.order_details->>'Choose Color' IS DISTINCT FROM OLD.order_details->>'Choose Color' THEN
      RAISE EXCEPTION 'Manual individual order facts are immutable.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_manual_individual_facts() FROM PUBLIC;
CREATE TRIGGER protect_manual_individual_facts_before_write
  BEFORE UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.protect_manual_individual_facts();
