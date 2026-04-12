
CREATE TABLE public.card_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  user_id UUID NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'direct',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.card_scans ENABLE ROW LEVEL SECURITY;

-- Specialists can view their own scan history
CREATE POLICY "Users can view own card scans"
ON public.card_scans
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Anyone can insert a scan (unauthenticated visitors scanning QR)
CREATE POLICY "Anyone can log a card scan"
ON public.card_scans
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create index for fast lookups by user
CREATE INDEX idx_card_scans_user_id ON public.card_scans(user_id);
CREATE INDEX idx_card_scans_card_id ON public.card_scans(card_id);
