CREATE TABLE public.ad_campaign_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  metric_date date NOT NULL,
  spend_cents integer NOT NULL DEFAULT 0,
  total_reach integer NOT NULL DEFAULT 0,
  total_impressions integer NOT NULL DEFAULT 0,
  total_leads integer NOT NULL DEFAULT 0,
  raw_insight jsonb,
  source_updated_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_campaign_metrics_daily_unique UNIQUE (campaign_id, metric_date)
);

CREATE INDEX idx_ad_campaign_metrics_daily_customer_date
  ON public.ad_campaign_metrics_daily (customer_id, metric_date DESC);
CREATE INDEX idx_ad_campaign_metrics_daily_campaign_date
  ON public.ad_campaign_metrics_daily (campaign_id, metric_date DESC);

GRANT SELECT ON public.ad_campaign_metrics_daily TO authenticated;
GRANT ALL ON public.ad_campaign_metrics_daily TO service_role;

ALTER TABLE public.ad_campaign_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own campaign metrics"
  ON public.ad_campaign_metrics_daily
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ad_campaign_metrics_daily_updated_at
  BEFORE UPDATE ON public.ad_campaign_metrics_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ad_campaign_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  provider text NOT NULL,
  external_appointment_id text NOT NULL,
  booked_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_campaign_appointments_unique UNIQUE (provider, external_appointment_id)
);

CREATE INDEX idx_ad_campaign_appointments_campaign_booked
  ON public.ad_campaign_appointments (campaign_id, booked_at DESC);
CREATE INDEX idx_ad_campaign_appointments_customer
  ON public.ad_campaign_appointments (customer_id, booked_at DESC);

GRANT SELECT ON public.ad_campaign_appointments TO authenticated;
GRANT ALL ON public.ad_campaign_appointments TO service_role;

ALTER TABLE public.ad_campaign_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own campaign appointments"
  ON public.ad_campaign_appointments
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ad_campaign_appointments_updated_at
  BEFORE UPDATE ON public.ad_campaign_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();