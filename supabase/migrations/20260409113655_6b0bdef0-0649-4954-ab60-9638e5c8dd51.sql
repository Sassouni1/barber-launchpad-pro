ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS first_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_handle text DEFAULT '',
  ADD COLUMN IF NOT EXISTS website_url text DEFAULT '';