-- Keep the verified agency ad account available in the existing admin campaign picker.
-- Production may already contain this row; do not overwrite later admin changes.
INSERT INTO public.meta_ad_accounts (meta_ad_account_id, name, account_mode, currency, active)
VALUES ('2895514127400266', 'Barber Launch Official', 'managed', 'USD', true)
ON CONFLICT (meta_ad_account_id) DO NOTHING;
