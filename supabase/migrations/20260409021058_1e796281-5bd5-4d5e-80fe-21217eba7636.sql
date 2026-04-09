
-- Create business_cards table
CREATE TABLE public.business_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  booking_url TEXT NOT NULL DEFAULT '',
  gallery_url TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  hero_image_url TEXT DEFAULT '',
  short_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(short_code)
);

-- Enable RLS
ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;

-- Users can manage their own card
CREATE POLICY "Users can view own business card"
  ON public.business_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business card"
  ON public.business_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business card"
  ON public.business_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own business card"
  ON public.business_cards FOR DELETE
  USING (auth.uid() = user_id);

-- Public read for the bridge page (anyone scanning QR needs to see the card)
CREATE POLICY "Anyone can view business cards by short_code"
  ON public.business_cards FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_business_cards_updated_at
  BEFORE UPDATE ON public.business_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for business card assets
INSERT INTO storage.buckets (id, name, public) VALUES ('business-card-assets', 'business-card-assets', true);

-- Storage policies
CREATE POLICY "Anyone can view business card assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-card-assets');

CREATE POLICY "Users can upload own business card assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'business-card-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own business card assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'business-card-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own business card assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'business-card-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
