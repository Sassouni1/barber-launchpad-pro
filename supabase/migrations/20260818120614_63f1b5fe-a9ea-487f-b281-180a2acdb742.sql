CREATE TABLE public.password_recovery_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_hash text NOT NULL,
  ip_hash text,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  status text NOT NULL CHECK (status IN ('sent','skipped','failed','rate_limited')),
  reason text,
  provider_message_id text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_recovery_audit_email_hash ON public.password_recovery_audit (email_hash, requested_at DESC);
CREATE INDEX idx_password_recovery_audit_ip_hash ON public.password_recovery_audit (ip_hash, requested_at DESC);

GRANT SELECT ON public.password_recovery_audit TO authenticated;
GRANT ALL ON public.password_recovery_audit TO service_role;

ALTER TABLE public.password_recovery_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view password recovery audit"
ON public.password_recovery_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));