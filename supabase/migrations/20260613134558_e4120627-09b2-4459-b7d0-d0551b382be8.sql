
CREATE TABLE public.access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  route TEXT,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_log_user_id_created_at ON public.access_log (user_id, created_at DESC);
CREATE INDEX idx_access_log_event_type ON public.access_log (event_type);

GRANT SELECT, INSERT ON public.access_log TO authenticated;
GRANT ALL ON public.access_log TO service_role;

ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own access log entries"
  ON public.access_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all access log entries"
  ON public.access_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own access log entries"
  ON public.access_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
