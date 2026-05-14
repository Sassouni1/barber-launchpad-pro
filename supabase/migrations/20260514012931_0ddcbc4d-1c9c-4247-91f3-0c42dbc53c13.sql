CREATE TABLE public.marketing_audience_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  target_ethnicities TEXT[] NOT NULL DEFAULT ARRAY['mixed']::TEXT[],
  target_age_range TEXT NOT NULL DEFAULT 'mixed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_audience_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audience settings"
ON public.marketing_audience_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audience settings"
ON public.marketing_audience_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audience settings"
ON public.marketing_audience_settings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audience settings"
ON public.marketing_audience_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_marketing_audience_settings_updated_at
BEFORE UPDATE ON public.marketing_audience_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();