-- Only Chris's admin account may delete orders. Supplier and other admin
-- sessions can still use their existing order-management permissions.
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

CREATE POLICY "Only Chris can delete orders"
ON public.orders FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND lower(auth.jwt() ->> 'email') = 'chris@invasiondigitalmedia.com'
);
