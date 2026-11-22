DROP TRIGGER IF EXISTS member_access_grants_audit ON public.member_access_grants;

CREATE OR REPLACE FUNCTION public.touch_member_access_grant()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_member_access_grant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := CASE WHEN NEW.status = 'active' THEN 'granted' ELSE 'recorded_revoked' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _action := CASE WHEN NEW.status = 'active' THEN 'reinstated' ELSE 'revoked' END;
  ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    _action := 'linked';
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.member_access_events (grant_id, user_id, email_normalized, action, actor, reason, details)
  VALUES (NEW.id, NEW.user_id, NEW.email_normalized, _action,
          CASE WHEN NEW.status = 'revoked' THEN NEW.revoked_by ELSE NEW.granted_by END,
          NEW.status_reason,
          jsonb_build_object('source', NEW.source, 'evidence_ref', NEW.evidence_ref,
                             'previous_user_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.user_id END,
                             'system', NEW.revoked_by_system));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.log_member_access_grant_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_member_access_grant() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER member_access_grants_touch
  BEFORE UPDATE ON public.member_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.touch_member_access_grant();
CREATE TRIGGER member_access_grants_audit
  AFTER INSERT OR UPDATE ON public.member_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.log_member_access_grant_change();

ALTER TABLE public.member_access_events DISABLE TRIGGER member_access_events_append_only;
DELETE FROM public.member_access_events e
WHERE e.grant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.member_access_grants g WHERE g.id = e.grant_id);
ALTER TABLE public.member_access_events ENABLE TRIGGER member_access_events_append_only;