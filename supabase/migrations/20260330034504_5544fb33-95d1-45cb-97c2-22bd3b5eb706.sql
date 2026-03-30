
-- Add explicit deny-all policies for app_secrets (accessed only via security definer RPCs)
CREATE POLICY "No direct access to app_secrets"
  ON public.app_secrets FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
