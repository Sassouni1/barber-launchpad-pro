
REVOKE ALL ON FUNCTION public.hair_system_claim_webhook_event(text, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_order_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hair_system_claim_webhook_event(text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_notification(uuid, text, text) TO service_role;
