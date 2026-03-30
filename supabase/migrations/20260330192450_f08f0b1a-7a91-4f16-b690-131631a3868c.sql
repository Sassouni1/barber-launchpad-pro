CREATE OR REPLACE FUNCTION public.resolve_qr_link(code text)
 RETURNS TABLE(destination_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Increment scan count (ignore failures so redirect still works)
  BEGIN
    UPDATE public.qr_links SET scan_count = scan_count + 1 WHERE short_code = code;
  EXCEPTION WHEN OTHERS THEN
    -- silently ignore update errors
  END;
  RETURN QUERY SELECT qr_links.destination_url FROM public.qr_links WHERE short_code = code;
END;
$$;