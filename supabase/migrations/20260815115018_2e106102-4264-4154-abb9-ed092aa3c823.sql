DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Unschedule the hourly reporting sync job if present
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'managed-ad-reporting-hourly') THEN
    PERFORM cron.unschedule('managed-ad-reporting-hourly');
  END IF;

  -- 2. Rotate the Vault secret to a freshly generated random value (never selected or printed)
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'REPORTING_SYNC_SECRET';
  IF v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, encode(gen_random_bytes(32), 'hex'));
  ELSE
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'REPORTING_SYNC_SECRET', 'Managed ad reporting sync shared secret');
  END IF;
END $$;