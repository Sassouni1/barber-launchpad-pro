CREATE TABLE public.password_reset_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  email text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  outcome text NOT NULL CHECK (outcome IN ('attempted','sent','skipped','failed','rate_limited')),
  reason text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.password_reset_delivery_attempts TO service_role;
GRANT SELECT ON public.password_reset_delivery_attempts TO authenticated;

ALTER TABLE public.password_reset_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view password reset delivery attempts"
ON public.password_reset_delivery_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_prda_email_requested_at ON public.password_reset_delivery_attempts (email, requested_at DESC);
CREATE INDEX idx_prda_ip_requested_at ON public.password_reset_delivery_attempts (ip_hash, requested_at DESC);