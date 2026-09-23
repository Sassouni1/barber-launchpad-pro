ALTER TABLE public.order_notifications
  DROP CONSTRAINT IF EXISTS order_notifications_channel_check;

ALTER TABLE public.order_notifications
  ADD CONSTRAINT order_notifications_channel_check
  CHECK (channel IN ('customer_email', 'customer_receipt', 'customer_sms', 'supplier_email', 'crm_sync'));