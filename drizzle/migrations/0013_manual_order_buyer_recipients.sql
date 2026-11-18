-- Immutable buyer recipient binding for existing manual individual orders,
-- kept separate from the protected orders row. Read only by the server-side
-- buyer-shipping-notify sender, which re-checks the linked profile each time.
CREATE TABLE public.manual_order_buyer_recipients (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id),
  profile_id uuid NOT NULL,
  ghl_contact_id text NOT NULL CHECK (ghl_contact_id ~ '^[A-Za-z0-9]{20}$'),
  verified_name text NOT NULL CHECK (verified_name = btrim(verified_name) AND verified_name <> ''),
  verified_email text NOT NULL CHECK (verified_email = lower(btrim(verified_email)) AND verified_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  verified_phone text NOT NULL CHECK (verified_phone ~ '^\+[1-9][0-9]{7,14}$'),
  verification_source text NOT NULL CHECK (btrim(verification_source) <> ''),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.manual_order_buyer_recipients FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.manual_order_buyer_recipients TO service_role;
ALTER TABLE public.manual_order_buyer_recipients ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no access; service_role reads only.

CREATE FUNCTION public.guard_manual_order_buyer_recipient() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = NEW.order_id
        AND o.order_details->>'manual_individual' = 'true'
        AND o.order_details->>'manual_source' = 'admin_entry'
        AND o.order_details->>'supplier_kit' IS DISTINCT FROM 'true'
        AND o.order_details->>'kit_order' IS DISTINCT FROM 'true'
    ) THEN
      RAISE EXCEPTION 'Buyer recipient bindings are only allowed for manual individual admin-entry orders.';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Manual order buyer recipient bindings are immutable.';
END;
$$;
REVOKE ALL ON FUNCTION public.guard_manual_order_buyer_recipient() FROM PUBLIC;
CREATE TRIGGER guard_manual_order_buyer_recipient_row
  BEFORE INSERT OR UPDATE OR DELETE ON public.manual_order_buyer_recipients
  FOR EACH ROW EXECUTE FUNCTION public.guard_manual_order_buyer_recipient();
CREATE TRIGGER guard_manual_order_buyer_recipient_truncate
  BEFORE TRUNCATE ON public.manual_order_buyer_recipients
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_manual_order_buyer_recipient();