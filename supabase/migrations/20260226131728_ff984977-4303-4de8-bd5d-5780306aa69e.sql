
-- Add referral columns to reward_clients
ALTER TABLE public.reward_clients
  ADD COLUMN referred_by_client_id uuid REFERENCES public.reward_clients(id) ON DELETE SET NULL,
  ADD COLUMN referral_redeemed_count integer NOT NULL DEFAULT 0;
