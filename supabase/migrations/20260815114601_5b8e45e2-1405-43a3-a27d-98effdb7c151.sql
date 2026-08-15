DROP POLICY IF EXISTS "Members can view their own campaign metrics" ON public.ad_campaign_metrics_daily;
DROP POLICY IF EXISTS "Members can view their own campaign appointments" ON public.ad_campaign_appointments;

REVOKE ALL ON public.ad_campaign_metrics_daily FROM anon, authenticated;
REVOKE ALL ON public.ad_campaign_appointments FROM anon, authenticated;

GRANT ALL ON public.ad_campaign_metrics_daily TO service_role;
GRANT ALL ON public.ad_campaign_appointments TO service_role;

ALTER TABLE public.ad_campaign_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_appointments ENABLE ROW LEVEL SECURITY;