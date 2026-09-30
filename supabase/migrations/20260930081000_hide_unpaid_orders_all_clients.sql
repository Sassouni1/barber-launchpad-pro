-- Receipt and production-order screens use authenticated client queries.
-- Keep unpaid attempts only for server-side audit; hide them from every client
-- role, including administrators, until the frontend receipt guard is published.
ALTER POLICY "Only completed purchases appear in order reads"
ON public.orders
USING (status IS DISTINCT FROM 'pending_payment');
