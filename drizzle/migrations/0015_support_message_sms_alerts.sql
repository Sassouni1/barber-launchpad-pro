CREATE TABLE public.support_message_sms_alerts (
  message_id uuid PRIMARY KEY REFERENCES public.support_messages(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL,
  member_id uuid NOT NULL,
  message_created_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'uncertain', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  provider_message_id text,
  dispatch_request_id bigint,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.support_message_sms_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.support_message_sms_alerts TO authenticated;
GRANT ALL ON public.support_message_sms_alerts TO service_role;
ALTER TABLE public.support_message_sms_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view support message SMS alerts"
  ON public.support_message_sms_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX support_message_sms_alerts_status_idx
  ON public.support_message_sms_alerts (status, message_created_at);

-- Server-only token check for the trigger -> function call (same pattern as other internal jobs).
CREATE FUNCTION public.verify_support_sms_alert_token(_token text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(length(_token) >= 32 AND EXISTS (
    SELECT 1 FROM public.internal_cron_tokens
    WHERE name = 'support_message_sms_alert' AND token_sha256 = extensions.digest(_token, 'sha256')
  ), false)
$$;

-- One claim per message: pending, or a definitely-not-sent failure under 3 attempts, within 6 hours.
CREATE FUNCTION public.claim_support_message_sms_alert(_message_id uuid)
RETURNS SETOF public.support_message_sms_alerts
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.support_message_sms_alerts
  SET status = 'sending', attempts = attempts + 1, claimed_at = now(), updated_at = now()
  WHERE message_id = _message_id
    AND (status = 'pending' OR (status = 'failed' AND attempts < 3))
    AND message_created_at > now() - interval '6 hours'
  RETURNING *
$$;

-- Stale 'sending' rows may have been delivered: mark uncertain (never resent). Then list retryable rows.
CREATE FUNCTION public.support_message_sms_alert_retry_candidates(_limit integer)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_message_sms_alerts
  SET status = 'uncertain', last_error = left(coalesce(last_error || '; ', '') || 'worker_stopped_mid_send', 300), updated_at = now()
  WHERE status = 'sending' AND claimed_at < now() - interval '10 minutes';
  RETURN QUERY
    SELECT a.message_id FROM public.support_message_sms_alerts a
    WHERE a.message_created_at > now() - interval '6 hours'
      AND ((a.status = 'pending' AND a.created_at < now() - interval '2 minutes')
        OR (a.status = 'failed' AND a.attempts < 3 AND a.updated_at < now() - interval '2 minutes'))
    ORDER BY a.message_created_at
    LIMIT least(greatest(coalesce(_limit, 0), 0), 10);
END $$;

-- Member messages after the alert cutover that never got a ledger row (missed enqueue).
CREATE FUNCTION public.support_message_sms_alert_missing() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer
  FROM public.support_messages m
  JOIN public.support_conversations c ON c.id = m.conversation_id
  WHERE m.created_at >= timestamptz '2026-11-21 11:25:00+00'
    AND m.sender_id = c.member_id
    AND NOT public.has_role(m.sender_id, 'admin')
    AND NOT EXISTS (SELECT 1 FROM public.support_message_sms_alerts a WHERE a.message_id = m.id)
$$;

-- Never blocks the member's message: every failure is caught and logged.
CREATE FUNCTION public.enqueue_support_message_sms_alert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member uuid;
  v_token text;
  v_request bigint;
BEGIN
  BEGIN
    SELECT member_id INTO v_member FROM public.support_conversations WHERE id = NEW.conversation_id;
    IF v_member IS NULL OR NEW.sender_id IS DISTINCT FROM v_member OR NEW.deleted_at IS NOT NULL
       OR public.has_role(NEW.sender_id, 'admin') THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.support_message_sms_alerts (message_id, conversation_id, member_id, message_created_at)
    VALUES (NEW.id, NEW.conversation_id, NEW.sender_id, NEW.created_at)
    ON CONFLICT (message_id) DO NOTHING;
    IF NOT FOUND THEN RETURN NEW; END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'support SMS alert ledger insert failed for message %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  BEGIN
    SELECT token INTO v_token FROM public.internal_cron_tokens WHERE name = 'support_message_sms_alert';
    IF v_token IS NULL THEN
      UPDATE public.support_message_sms_alerts SET last_error = 'dispatch_token_missing' WHERE message_id = NEW.id;
      RETURN NEW;
    END IF;
    SELECT net.http_post(
      url := 'https://ynooatjtgstgwfssnira.supabase.co/functions/v1/notify-support-message',
      body := jsonb_build_object('messageId', NEW.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlub29hdGp0Z3N0Z3dmc3NuaXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjIyMzAsImV4cCI6MjA4MDk5ODIzMH0.iyoy81sovUVMa7YfNUOo-mxaTipBGWX166V9QCZ3w3A',
        'x-alert-token', v_token),
      timeout_milliseconds := 30000
    ) INTO v_request;
    UPDATE public.support_message_sms_alerts SET dispatch_request_id = v_request WHERE message_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      UPDATE public.support_message_sms_alerts
      SET last_error = left('dispatch_enqueue_failed: ' || SQLERRM, 300) WHERE message_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'support SMS alert dispatch failed for message %: %', NEW.id, SQLERRM;
    END;
  END;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.verify_support_sms_alert_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_support_message_sms_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_message_sms_alert_retry_candidates(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_message_sms_alert_missing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_support_message_sms_alert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_support_sms_alert_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_support_message_sms_alert(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_message_sms_alert_retry_candidates(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_message_sms_alert_missing() TO service_role;

CREATE TRIGGER trg_support_message_sms_alert
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_support_message_sms_alert();