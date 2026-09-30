CREATE TABLE public.hair_system_webhook_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  event_id text,
  event_type text,
  signature_header_present boolean NOT NULL,
  signature_valid boolean NOT NULL,
  timestamp_skew_seconds integer,
  outcome text NOT NULL,
  user_agent text
);
GRANT ALL ON public.hair_system_webhook_attempts TO service_role;
GRANT SELECT ON public.hair_system_webhook_attempts TO authenticated;
ALTER TABLE public.hair_system_webhook_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webhook attempts" ON public.hair_system_webhook_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('hair_system_fulfillment_hold', 'true'::jsonb)
ON CONFLICT DO NOTHING;