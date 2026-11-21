CREATE OR REPLACE FUNCTION public.search_specialists(search_lat double precision, search_lng double precision, radius_miles integer DEFAULT 50)
 RETURNS TABLE(id uuid, business_name text, first_name text, last_name text, city text, state text, hero_photo_url text, instagram_handle text, booking_url text, bio text, phone text, email text, distance_miles double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM (
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
      -- Great-circle distance in miles; the cosine is clamped to [-1, 1] because floating-point
      -- rounding can exceed 1 when the search point equals a listing's coordinates (acos would error).
      (3959 * acos(least(1::double precision, greatest(-1::double precision,
        cos(radians(search_lat)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(search_lng)) +
        sin(radians(search_lat)) * sin(radians(s.latitude))
      )))) AS distance_miles
    FROM public.specialist_directory s
    WHERE s.approved = true
      AND s.visible = true
      AND s.latitude IS NOT NULL
      AND s.longitude IS NOT NULL
  ) d
  WHERE d.distance_miles <= radius_miles
  ORDER BY d.distance_miles ASC
  LIMIT 10;
$function$;