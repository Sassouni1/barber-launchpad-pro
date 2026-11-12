-- Barber Launch advertising access (Page task ADVERTISE) for each member's selected Facebook Page.
-- Only the managed-ad-social function (service role) writes these columns after a Meta read;
-- members keep read-only access to their own row through the existing SELECT policy.
-- Existing rows start as 'unknown': no member's Page is treated as granted until they act.
ALTER TABLE public.ad_social_connections
  ADD COLUMN IF NOT EXISTS page_ad_access_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS page_ad_access_page_id text,
  ADD COLUMN IF NOT EXISTS page_ad_access_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS page_ad_access_error text;

ALTER TABLE public.ad_social_connections
  DROP CONSTRAINT IF EXISTS ad_social_connections_page_ad_access_status_check;
ALTER TABLE public.ad_social_connections
  ADD CONSTRAINT ad_social_connections_page_ad_access_status_check
  CHECK (page_ad_access_status IN ('unknown', 'pending', 'granted', 'error'));

COMMENT ON COLUMN public.ad_social_connections.page_ad_access_status IS
  'Barber Launch business ADVERTISE access to facebook_page_id: unknown/pending/granted/error. granted only after a Meta read confirms it.';
COMMENT ON COLUMN public.ad_social_connections.page_ad_access_page_id IS
  'Page ID the access status was checked for; a status for a different Page is ignored.';
