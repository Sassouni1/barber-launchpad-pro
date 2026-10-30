CREATE TABLE public.internal_cron_tokens (
  name text PRIMARY KEY,
  token_sha256 bytea NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.internal_cron_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.internal_cron_tokens TO service_role;
ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.internal_cron_tokens IS 'Server-only scheduler tokens; no client grants or policies. Read only by pg_cron (postgres) and the verify function.';

CREATE OR REPLACE FUNCTION public.verify_buyer_shipping_cron_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(length(_token) >= 32 AND EXISTS (
    SELECT 1 FROM public.internal_cron_tokens
    WHERE name = 'buyer_shipping_notify' AND token_sha256 = extensions.digest(_token, 'sha256')
  ), false)
$$;
REVOKE ALL ON FUNCTION public.verify_buyer_shipping_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_buyer_shipping_cron_token(text) TO service_role;