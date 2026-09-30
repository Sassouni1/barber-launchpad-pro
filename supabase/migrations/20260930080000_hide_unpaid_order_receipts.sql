-- Keep historical prepayment attempts for audit while preventing the live
-- member and manufacturer clients from rendering them as purchase receipts.
-- Service-role fulfillment still sees every order; admins retain audit access.
CREATE POLICY "Only completed purchases appear in order reads"
ON public.orders AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  status IS DISTINCT FROM 'pending_payment'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
