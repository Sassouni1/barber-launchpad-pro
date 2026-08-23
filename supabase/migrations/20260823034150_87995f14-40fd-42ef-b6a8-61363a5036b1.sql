ALTER VIEW public.published_sites SET (security_invoker = on);
REVOKE ALL ON public.published_sites FROM anon, authenticated;
GRANT SELECT ON public.published_sites TO service_role;