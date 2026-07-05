
ALTER TABLE public.access_log
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS isp text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS device_type text;

CREATE INDEX IF NOT EXISTS idx_access_log_ip_address ON public.access_log (ip_address);
CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON public.access_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_session_id ON public.access_log (session_id);
