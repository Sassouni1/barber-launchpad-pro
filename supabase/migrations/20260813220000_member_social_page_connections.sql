CREATE TABLE public.ad_social_connections (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'facebook' CHECK (provider = 'facebook'),
  facebook_page_id text,
  facebook_page_name text,
  instagram_business_account_id text,
  connection_status text NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected', 'connected', 'reauth_required', 'error')),
  connected_at timestamptz,
  last_synced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view their own social connection" ON public.ad_social_connections FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage social connections" ON public.ad_social_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_ad_social_connections_updated_at BEFORE UPDATE ON public.ad_social_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
