CREATE TABLE public.custom_hair_system_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL,
  hair_length TEXT,
  base_details TEXT,
  color TEXT,
  curl_or_wave TEXT,
  needed_by DATE,
  description TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_hair_system_requests TO authenticated;
GRANT ALL ON public.custom_hair_system_requests TO service_role;

ALTER TABLE public.custom_hair_system_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members insert own custom requests"
  ON public.custom_hair_system_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members view own custom requests"
  ON public.custom_hair_system_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update custom requests"
  ON public.custom_hair_system_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_custom_hair_system_requests_updated_at
  BEFORE UPDATE ON public.custom_hair_system_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_custom_hair_system_requests_user ON public.custom_hair_system_requests (user_id, created_at DESC);