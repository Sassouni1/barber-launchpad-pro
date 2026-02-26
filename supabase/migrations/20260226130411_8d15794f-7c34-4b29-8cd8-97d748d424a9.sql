
-- Create reward_clients table
CREATE TABLE public.reward_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reward_clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for reward_clients
CREATE POLICY "Users can view own reward clients" ON public.reward_clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reward clients" ON public.reward_clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reward clients" ON public.reward_clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reward clients" ON public.reward_clients FOR DELETE USING (auth.uid() = user_id);

-- Create reward_visits table
CREATE TABLE public.reward_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.reward_clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_redemption BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reward_visits ENABLE ROW LEVEL SECURITY;

-- RLS policies for reward_visits
CREATE POLICY "Users can view own reward visits" ON public.reward_visits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reward visits" ON public.reward_visits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reward visits" ON public.reward_visits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reward visits" ON public.reward_visits FOR DELETE USING (auth.uid() = user_id);
