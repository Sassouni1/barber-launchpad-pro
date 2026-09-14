REVOKE EXECUTE ON FUNCTION public.affiliate_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_totals(uuid) TO authenticated, service_role;