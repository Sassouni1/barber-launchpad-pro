REVOKE ALL ON public.hair_system_kit_activation FROM anon, authenticated;
REVOKE ALL ON public.hair_system_kit_deliveries FROM anon, authenticated;
GRANT ALL ON public.hair_system_kit_activation TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.hair_system_kit_deliveries TO service_role;