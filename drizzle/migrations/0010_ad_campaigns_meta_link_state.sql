ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS meta_create_status text,
  ADD COLUMN IF NOT EXISTS meta_create_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS meta_create_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_create_error text,
  ADD COLUMN IF NOT EXISTS meta_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_linked_by uuid,
  ADD COLUMN IF NOT EXISTS meta_campaign_status text,
  ADD COLUMN IF NOT EXISTS meta_effective_status text,
  ADD COLUMN IF NOT EXISTS meta_status_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_metrics_30d jsonb,
  ADD COLUMN IF NOT EXISTS last_metrics_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_metrics_sync_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_metrics_sync_error text;

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_meta_create_status_check
  CHECK (meta_create_status IS NULL OR meta_create_status IN ('creating', 'unknown', 'failed', 'created', 'linked'));

-- Meta link/state fields are written only by server functions (service role), never from the browser.
CREATE OR REPLACE FUNCTION public.guard_ad_campaign_meta_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.meta_campaign_id IS NOT NULL OR NEW.meta_create_status IS NOT NULL OR NEW.meta_create_attempt_id IS NOT NULL
       OR NEW.meta_created_at IS NOT NULL OR NEW.meta_linked_at IS NOT NULL OR NEW.meta_linked_by IS NOT NULL
       OR NEW.meta_campaign_status IS NOT NULL OR NEW.meta_effective_status IS NOT NULL OR NEW.meta_status_checked_at IS NOT NULL
       OR NEW.meta_metrics_30d IS NOT NULL OR NEW.last_metrics_sync_at IS NOT NULL OR NEW.last_metrics_sync_attempt_at IS NOT NULL
       OR NEW.last_metrics_sync_error IS NOT NULL OR NEW.meta_create_started_at IS NOT NULL OR NEW.meta_create_error IS NOT NULL THEN
      RAISE EXCEPTION 'Meta campaign fields can only be set by the server after Meta confirms them.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.meta_campaign_id IS DISTINCT FROM OLD.meta_campaign_id
     OR (OLD.meta_campaign_id IS NOT NULL AND NEW.meta_ad_account_id IS DISTINCT FROM OLD.meta_ad_account_id)
     OR (OLD.meta_create_status IS NOT NULL AND NEW.meta_ad_account_id IS DISTINCT FROM OLD.meta_ad_account_id)
     OR (OLD.meta_campaign_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM OLD.customer_id)
     OR NEW.meta_create_status IS DISTINCT FROM OLD.meta_create_status
     OR NEW.meta_create_attempt_id IS DISTINCT FROM OLD.meta_create_attempt_id
     OR NEW.meta_create_started_at IS DISTINCT FROM OLD.meta_create_started_at
     OR NEW.meta_create_error IS DISTINCT FROM OLD.meta_create_error
     OR NEW.meta_created_at IS DISTINCT FROM OLD.meta_created_at
     OR NEW.meta_linked_at IS DISTINCT FROM OLD.meta_linked_at
     OR NEW.meta_linked_by IS DISTINCT FROM OLD.meta_linked_by
     OR NEW.meta_campaign_status IS DISTINCT FROM OLD.meta_campaign_status
     OR NEW.meta_effective_status IS DISTINCT FROM OLD.meta_effective_status
     OR NEW.meta_status_checked_at IS DISTINCT FROM OLD.meta_status_checked_at
     OR NEW.meta_metrics_30d IS DISTINCT FROM OLD.meta_metrics_30d
     OR NEW.last_metrics_sync_at IS DISTINCT FROM OLD.last_metrics_sync_at
     OR NEW.last_metrics_sync_attempt_at IS DISTINCT FROM OLD.last_metrics_sync_attempt_at
     OR NEW.last_metrics_sync_error IS DISTINCT FROM OLD.last_metrics_sync_error THEN
    RAISE EXCEPTION 'Meta campaign fields can only be changed by the server after Meta confirms them.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_ad_campaign_meta_fields
BEFORE INSERT OR UPDATE ON public.ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public.guard_ad_campaign_meta_fields();

-- Members read their campaigns only through server functions that omit the ad account.
DROP POLICY IF EXISTS "Members can view their own ad campaigns" ON public.ad_campaigns;

-- Hourly results sync: the scheduler token is stored hashed and checked server-side.
CREATE OR REPLACE FUNCTION public.verify_managed_ad_reporting_cron_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(length(_token) >= 32 AND EXISTS (
    SELECT 1 FROM public.internal_cron_tokens
    WHERE name = 'managed_ad_reporting' AND token_sha256 = extensions.digest(_token, 'sha256')
  ), false)
$$;
REVOKE ALL ON FUNCTION public.verify_managed_ad_reporting_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_managed_ad_reporting_cron_token(text) TO service_role;