-- Temporarily move the legacy draft/invalid row to a status the old constraint accepts.
UPDATE public.member_websites
  SET deployment_status = 'published'
  WHERE deployment_status NOT IN ('published', 'failed');

ALTER TABLE public.member_websites
  DROP CONSTRAINT IF EXISTS member_websites_deployment_status;

ALTER TABLE public.member_websites
  ADD CONSTRAINT member_websites_deployment_status
  CHECK (deployment_status IN ('not_published', 'published', 'domain_pending', 'failed'));

-- Restore the previously draft/unpublished Stay Faded row to the canonical unpublished status.
UPDATE public.member_websites
  SET deployment_status = 'not_published'
  WHERE template_key = 'stay-faded'
    AND published_at IS NULL;
