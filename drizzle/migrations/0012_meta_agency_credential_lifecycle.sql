CREATE TABLE public.meta_agency_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('manual_secret','exchange')),
  business_id text NOT NULL CHECK (business_id = '1832826473434326'),
  ad_account_id text NOT NULL CHECK (ad_account_id = '2895514127400266'),
  app_id text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  data_access_expires_at timestamptz,
  verified_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meta_agency_credentials TO service_role;
REVOKE ALL ON public.meta_agency_credentials FROM anon, authenticated;
ALTER TABLE public.meta_agency_credentials ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX meta_agency_credentials_one_active ON public.meta_agency_credentials ((true)) WHERE is_active;

CREATE TABLE public.meta_agency_credential_status (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  state text NOT NULL DEFAULT 'unchecked',
  token_source text,
  renewable boolean,
  expires_at timestamptz,
  data_access_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  last_checked_at timestamptz,
  last_healthy_at timestamptz,
  last_renewal_attempt_at timestamptz,
  last_renewed_at timestamptz,
  last_error_code integer,
  last_error_message text,
  action_required text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_agency_credential_status TO authenticated;
GRANT ALL ON public.meta_agency_credential_status TO service_role;
ALTER TABLE public.meta_agency_credential_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read agency credential status" ON public.meta_agency_credential_status
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.meta_agency_credential_status (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.meta_agency_activate_credential(
  _secret_id uuid, _source text, _app_id text, _scopes text[],
  _expires_at timestamptz, _data_access_expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  UPDATE public.meta_agency_credentials SET is_active = false, superseded_at = now() WHERE is_active;
  INSERT INTO public.meta_agency_credentials (secret_id, source, business_id, ad_account_id, app_id, scopes, expires_at, data_access_expires_at, is_active)
  VALUES (_secret_id, _source, '1832826473434326', '2895514127400266', _app_id, coalesce(_scopes,'{}'), _expires_at, _data_access_expires_at, true)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.meta_agency_activate_credential(uuid,text,text,text[],timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_agency_activate_credential(uuid,text,text,text[],timestamptz,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_meta_agency_credential_cron_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(length(_token) >= 32 AND EXISTS (
    SELECT 1 FROM public.internal_cron_tokens
    WHERE name = 'meta_agency_credential' AND token_sha256 = extensions.digest(_token, 'sha256')
  ), false)
$$;
REVOKE ALL ON FUNCTION public.verify_meta_agency_credential_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_meta_agency_credential_cron_token(text) TO service_role;