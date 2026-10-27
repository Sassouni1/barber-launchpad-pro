CREATE TABLE public.supplier_payment_markers (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL DEFAULT now(),
  marked_by uuid NOT NULL DEFAULT auth.uid()
);
COMMENT ON TABLE public.supplier_payment_markers IS 'Manual marker: Chris paid the supplier in full for this order. Separate from customer payment.';
GRANT SELECT, INSERT, DELETE ON public.supplier_payment_markers TO authenticated;
GRANT ALL ON public.supplier_payment_markers TO service_role;
ALTER TABLE public.supplier_payment_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chris admin reads supplier payment markers" ON public.supplier_payment_markers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND lower(auth.jwt() ->> 'email') = 'chris@invasiondigitalmedia.com');
CREATE POLICY "Chris admin marks supplier paid" ON public.supplier_payment_markers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND lower(auth.jwt() ->> 'email') = 'chris@invasiondigitalmedia.com' AND marked_by = auth.uid());
CREATE POLICY "Chris admin clears supplier paid" ON public.supplier_payment_markers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND lower(auth.jwt() ->> 'email') = 'chris@invasiondigitalmedia.com');