-- One claim per member/course installation upload window. Claims are retained so
-- replaying the same photo cannot send another SMS after the window expires.
CREATE TABLE public.certification_install_alert_claims (
  submission_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent', 'failed'))
);

CREATE INDEX certification_install_alert_claims_scope_time_idx
  ON public.certification_install_alert_claims (user_id, course_id, claimed_at DESC);

ALTER TABLE public.certification_install_alert_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.certification_install_alert_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.certification_install_alert_claims TO service_role;

CREATE FUNCTION public.claim_certification_install_alert(_submission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  member_id uuid;
  course_id uuid;
BEGIN
  SELECT p.user_id, p.course_id INTO member_id, course_id
  FROM public.certification_photos AS p
  WHERE p.id = _submission_id AND p.photo_type = 'installation';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installation submission not found';
  END IF;

  -- Serialize all claims for this member/course. A second upload or retry
  -- observes the first committed claim before deciding whether to send.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(member_id::text || ':' || course_id::text, 0)
  );

  IF EXISTS (
    SELECT 1 FROM public.certification_install_alert_claims AS c
    WHERE c.submission_id = _submission_id
       OR (c.user_id = member_id AND c.course_id = course_id
           AND c.claimed_at > now() - interval '10 minutes')
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.certification_install_alert_claims
    (submission_id, user_id, course_id)
  VALUES (_submission_id, member_id, course_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_certification_install_alert(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_certification_install_alert(uuid) TO service_role;
