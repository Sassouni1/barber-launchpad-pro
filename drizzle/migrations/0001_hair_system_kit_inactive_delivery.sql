CREATE TABLE public.hair_system_kit_activation (
  singleton boolean PRIMARY KEY DEFAULT true CONSTRAINT kit_singleton_true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  activation_cutoff timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hair_system_kit_activation TO service_role;
ALTER TABLE public.hair_system_kit_activation ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.hair_system_kit_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  ghl_order_id text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  status text NOT NULL DEFAULT 'reserved' CONSTRAINT kit_delivery_status CHECK (status IN ('reserved','sent','uncertain')),
  message_id text,
  reason text,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (location_id, ghl_order_id)
);
GRANT SELECT, INSERT, UPDATE ON public.hair_system_kit_deliveries TO service_role;
ALTER TABLE public.hair_system_kit_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kit rows are supplier or admin only" ON public.orders AS RESTRICTIVE FOR SELECT TO public
USING (COALESCE(order_details->>'supplier_kit','false') <> 'true' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manufacturer'));
COMMENT ON TABLE public.hair_system_kit_activation IS 'Server-only kit gate. No activation row is seeded. Keep disabled until fresh GHL reads and published supplier page are verified; use a fresh cutoff on activation.';
COMMENT ON TABLE public.hair_system_kit_deliveries IS 'Permanent atomic location/order reservation. Reserved and uncertain deliveries must never be retried automatically; reconcile manually.';