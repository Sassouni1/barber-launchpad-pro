ALTER TABLE public.barber_launch_payment_links
  ADD COLUMN IF NOT EXISTS recurring_interval text,
  ADD COLUMN IF NOT EXISTS recurring_interval_count integer;