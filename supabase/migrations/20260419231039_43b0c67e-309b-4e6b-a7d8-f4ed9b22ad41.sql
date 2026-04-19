
-- Specialist directory table
CREATE TABLE public.specialist_directory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  hero_photo_url TEXT,
  instagram_handle TEXT,
  booking_url TEXT,
  bio TEXT,
  phone TEXT,
  email TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_specialist_directory_approved ON public.specialist_directory(approved, visible);
CREATE INDEX idx_specialist_directory_zip ON public.specialist_directory(zip_code);
CREATE INDEX idx_specialist_directory_geo ON public.specialist_directory(latitude, longitude);

ALTER TABLE public.specialist_directory ENABLE ROW LEVEL SECURITY;

-- Specialists manage own listing
CREATE POLICY "Specialists view own listing"
ON public.specialist_directory FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Specialists create own listing"
ON public.specialist_directory FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Specialists update own listing"
ON public.specialist_directory FOR UPDATE
USING (auth.uid() = user_id);

-- Admins manage all
CREATE POLICY "Admins view all listings"
ON public.specialist_directory FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update all listings"
ON public.specialist_directory FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete listings"
ON public.specialist_directory FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Updated at trigger
CREATE TRIGGER update_specialist_directory_updated_at
BEFORE UPDATE ON public.specialist_directory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Public search function — returns at most 10 nearest approved specialists
CREATE OR REPLACE FUNCTION public.search_specialists(
  search_lat DOUBLE PRECISION,
  search_lng DOUBLE PRECISION,
  radius_miles INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  business_name TEXT,
  first_name TEXT,
  last_name TEXT,
  city TEXT,
  state TEXT,
  hero_photo_url TEXT,
  instagram_handle TEXT,
  booking_url TEXT,
  bio TEXT,
  phone TEXT,
  email TEXT,
  distance_miles DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.business_name,
    s.first_name,
    s.last_name,
    s.city,
    s.state,
    s.hero_photo_url,
    s.instagram_handle,
    s.booking_url,
    s.bio,
    s.phone,
    s.email,
    -- Haversine distance in miles
    (3959 * acos(
      cos(radians(search_lat)) * cos(radians(s.latitude)) *
      cos(radians(s.longitude) - radians(search_lng)) +
      sin(radians(search_lat)) * sin(radians(s.latitude))
    )) AS distance_miles
  FROM public.specialist_directory s
  WHERE s.approved = true
    AND s.visible = true
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND (3959 * acos(
      cos(radians(search_lat)) * cos(radians(s.latitude)) *
      cos(radians(s.longitude) - radians(search_lng)) +
      sin(radians(search_lat)) * sin(radians(s.latitude))
    )) <= radius_miles
  ORDER BY distance_miles ASC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.search_specialists(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO anon, authenticated;

-- Storage bucket for hero photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('specialist-directory', 'specialist-directory', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view specialist photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'specialist-directory');

CREATE POLICY "Specialists upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'specialist-directory'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Specialists update own photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'specialist-directory'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Specialists delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'specialist-directory'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
