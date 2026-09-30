-- Keep historical prepayment attempts for audit while preventing the live
-- client views from rendering them as purchase receipts.
-- Service-role fulfillment still sees every order for audit and recovery.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders'
      AND policyname = 'Only completed purchases appear in order reads'
  ) THEN
    CREATE POLICY "Only completed purchases appear in order reads"
    ON public.orders AS RESTRICTIVE FOR SELECT TO authenticated
    USING (status IS DISTINCT FROM 'pending_payment');
  END IF;
END $$;
