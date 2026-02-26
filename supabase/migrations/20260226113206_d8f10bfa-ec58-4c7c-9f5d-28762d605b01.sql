
-- Create qr_links table
CREATE TABLE public.qr_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  label TEXT NOT NULL,
  scan_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qr_links ENABLE ROW LEVEL SECURITY;

-- RLS policies: users manage their own rows
CREATE POLICY "Users can view own qr_links" ON public.qr_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own qr_links" ON public.qr_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own qr_links" ON public.qr_links
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own qr_links" ON public.qr_links
  FOR DELETE USING (auth.uid() = user_id);

-- Security definer function for public redirect lookups (no auth needed)
CREATE OR REPLACE FUNCTION public.resolve_qr_link(code TEXT)
RETURNS TABLE(destination_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.qr_links SET scan_count = scan_count + 1 WHERE short_code = code;
  RETURN QUERY SELECT qr_links.destination_url FROM public.qr_links WHERE short_code = code;
END;
$$;

-- Updated_at trigger
CREATE TRIGGER update_qr_links_updated_at
  BEFORE UPDATE ON public.qr_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
