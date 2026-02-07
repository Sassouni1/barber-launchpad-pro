
-- Add external_order_id for deduplication of webhook double-fires
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS external_order_id TEXT UNIQUE;
