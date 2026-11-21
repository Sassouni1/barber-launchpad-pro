CREATE TABLE public.support_reply_sms_notifications (
  message_id uuid PRIMARY KEY REFERENCES public.support_messages(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL,
  member_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message_created_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'uncertain', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  recipient_last4 text,
  ghl_contact_id text,
  from_number text,
  provider_message_id text,
  provider_status text,
  provider_from text,
  sender_verified boolean,
  verified_at timestamptz,
  dispatch_request_id bigint,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.support_reply_sms_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.support_reply_sms_notifications TO authenticated;
GRANT ALL ON public.support_reply_sms_notifications TO service_role;
ALTER TABLE public.support_reply_sms_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view support reply SMS notifications"
  ON public.support_reply_sms_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX support_reply_sms_notifications_status_idx
  ON public.support_reply_sms_notifications (status, message_created_at);
CREATE INDEX support_reply_sms_notifications_conversation_idx
  ON public.support_reply_sms_notifications (conversation_id, sent_at);

CREATE FUNCTION public.verify_support_reply_sms_token(_token text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(length(_token) >= 32 AND EXISTS (
    SELECT 1 FROM public.internal_cron_tokens
    WHERE name = 'support_reply_sms' AND token_sha256 = extensions.digest(_token, 'sha256')
  ), false)
$$;

-- One claim per reply: pending, or a definitely-not-sent failure under 3 attempts, within 6 hours.
CREATE FUNCTION public.claim_support_reply_sms(_message_id uuid)
RETURNS SETOF public.support_reply_sms_notifications
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.support_reply_sms_notifications
  SET status = 'sending', attempts = attempts + 1, claimed_at = now(), updated_at = now()
  WHERE message_id = _message_id
    AND (status = 'pending' OR (status = 'failed' AND attempts < 3))
    AND message_created_at > now() - interval '6 hours'
  RETURNING *
$$;

-- Stale 'sending' rows may have been delivered: mark uncertain (never resent). Then list retryable rows.
CREATE FUNCTION public.support_reply_sms_retry_candidates(_limit integer)
RETURNS SETOF uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_reply_sms_notifications
  SET status = 'uncertain', last_error = left(coalesce(last_error || '; ', '') || 'worker_stopped_mid_send', 300), updated_at = now()
  WHERE status = 'sending' AND claimed_at < now() - interval '10 minutes';
  RETURN QUERY
    SELECT n.message_id FROM public.support_reply_sms_notifications n
    WHERE n.message_created_at > now() - interval '6 hours'
      AND ((n.status = 'pending' AND n.created_at < now() - interval '2 minutes')
        OR (n.status = 'failed' AND n.attempts < 3 AND n.updated_at < now() - interval '2 minutes'))
    ORDER BY n.message_created_at
    LIMIT least(greatest(coalesce(_limit, 0), 0), 10);
END $$;

-- Team replies created after this feature began that never got a ledger row (missed enqueue).
CREATE FUNCTION public.support_reply_sms_missing() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer
  FROM public.support_messages m
  JOIN public.support_conversations c ON c.id = m.conversation_id
  WHERE m.created_at >= (SELECT min(created_at) FROM public.internal_cron_tokens WHERE name = 'support_reply_sms')
    AND m.sender_id <> c.member_id
    AND public.has_role(m.sender_id, 'admin')
    AND NOT EXISTS (SELECT 1 FROM public.support_reply_sms_notifications n WHERE n.message_id = m.id)
$$;

-- Never blocks the team's reply: every failure is caught and logged.
CREATE FUNCTION public.enqueue_support_reply_sms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member uuid;
  v_token text;
  v_request bigint;
BEGIN
  BEGIN
    SELECT member_id INTO v_member FROM public.support_conversations WHERE id = NEW.conversation_id;
    IF v_member IS NULL OR NEW.sender_id IS NULL OR NEW.sender_id = v_member OR NEW.deleted_at IS NOT NULL
       OR NOT public.has_role(NEW.sender_id, 'admin') THEN
      RETURN NEW;
    END IF;
    SELECT token INTO v_token FROM public.internal_cron_tokens WHERE name = 'support_reply_sms';
    IF v_token IS NULL THEN
      RETURN NEW; -- feature not switched on: no ledger row, no text
    END IF;
    INSERT INTO public.support_reply_sms_notifications (message_id, conversation_id, member_id, sender_id, message_created_at)
    VALUES (NEW.id, NEW.conversation_id, v_member, NEW.sender_id, NEW.created_at)
    ON CONFLICT (message_id) DO NOTHING;
    IF NOT FOUND THEN RETURN NEW; END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'support reply SMS ledger insert failed for message %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;

  BEGIN
    SELECT net.http_post(
      url := 'https://ynooatjtgstgwfssnira.supabase.co/functions/v1/notify-support-reply',
      body := jsonb_build_object('messageId', NEW.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlub29hdGp0Z3N0Z3dmc3NuaXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjIyMzAsImV4cCI6MjA4MDk5ODIzMH0.iyoy81sovUVMa7YfNUOo-mxaTipBGWX166V9QCZ3w3A',
        'x-reply-token', v_token),
      timeout_milliseconds := 30000
    ) INTO v_request;
    UPDATE public.support_reply_sms_notifications SET dispatch_request_id = v_request WHERE message_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      UPDATE public.support_reply_sms_notifications
      SET last_error = left('dispatch_enqueue_failed: ' || SQLERRM, 300) WHERE message_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'support reply SMS dispatch failed for message %: %', NEW.id, SQLERRM;
    END;
  END;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.verify_support_reply_sms_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_support_reply_sms(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_reply_sms_retry_candidates(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_reply_sms_missing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_support_reply_sms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_support_reply_sms_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_support_reply_sms(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_reply_sms_retry_candidates(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.support_reply_sms_missing() TO service_role;

CREATE TRIGGER trg_support_reply_sms
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_support_reply_sms();