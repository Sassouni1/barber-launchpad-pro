
-- Make client_phone required and client_name optional
ALTER TABLE public.reward_clients ALTER COLUMN client_phone SET NOT NULL;
ALTER TABLE public.reward_clients ALTER COLUMN client_name DROP NOT NULL;
ALTER TABLE public.reward_clients ALTER COLUMN client_name SET DEFAULT '';
