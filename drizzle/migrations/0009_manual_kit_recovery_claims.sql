-- One permanent audit/claim per GHL enrollment and per Stripe payment.
-- A failed or interrupted confirmation is held for human reconciliation.
CREATE TABLE public.hair_system_kit_manual_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  ghl_order_id text NOT NULL,
  payment_id text NOT NULL,
  admin_id uuid NOT NULL,
  release_basis text NOT NULL CHECK (release_basis IN ('fully_paid', 'installment_entitlement', 'admin_entitlement')),
  reason text NOT NULL,
  address_evidence text NOT NULL,
  preview_facts jsonb NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'sent', 'uncertain')),
  supplier_order_id uuid REFERENCES public.orders(id),
  supplier_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (location_id, ghl_order_id),
  UNIQUE (payment_id)
);
ALTER TABLE public.hair_system_kit_manual_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hair_system_kit_manual_recoveries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hair_system_kit_manual_recoveries TO service_role;
COMMENT ON TABLE public.hair_system_kit_manual_recoveries IS 'Permanent manual kit release claim and audit. Reserved/uncertain outcomes require reconciliation, never an automatic resend.';
