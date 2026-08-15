ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.support_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent','edited','unsent')),
  body text NOT NULL,
  previous_body text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_message_events TO authenticated;
GRANT ALL ON public.support_message_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_support_message_events_message ON public.support_message_events (message_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_support_message_events_conversation ON public.support_message_events (conversation_id, occurred_at);

ALTER TABLE public.support_message_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view support message events" ON public.support_message_events;
CREATE POLICY "Admins can view support message events"
ON public.support_message_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.log_support_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_message_events (message_id, conversation_id, actor_id, event_type, body, occurred_at)
    VALUES (NEW.id, NEW.conversation_id, NEW.sender_id, 'sent', NEW.body, NEW.created_at);
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body THEN
    INSERT INTO public.support_message_events (message_id, conversation_id, actor_id, event_type, body, previous_body)
    VALUES (NEW.id, NEW.conversation_id, COALESCE(auth.uid(), NEW.sender_id), 'edited', NEW.body, OLD.body);
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO public.support_message_events (message_id, conversation_id, actor_id, event_type, body, previous_body, occurred_at)
    VALUES (NEW.id, NEW.conversation_id, COALESCE(NEW.deleted_by, auth.uid()), 'unsent', OLD.body, OLD.body, NEW.deleted_at);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_support_message_event ON public.support_messages;
CREATE TRIGGER trg_log_support_message_event
AFTER INSERT OR UPDATE ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.log_support_message_event();

INSERT INTO public.support_message_events (message_id, conversation_id, actor_id, event_type, body, occurred_at)
SELECT m.id, m.conversation_id, m.sender_id, 'sent', m.body, m.created_at
FROM public.support_messages m
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_message_events e
  WHERE e.message_id = m.id AND e.event_type = 'sent'
);

CREATE OR REPLACE FUNCTION public.edit_support_message(p_message_id uuid, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text := btrim(coalesce(p_body, ''));
  v_rows integer;
BEGIN
  IF v_body = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF length(v_body) > 4000 THEN
    RAISE EXCEPTION 'Message is too long';
  END IF;

  UPDATE public.support_messages
  SET body = v_body, edited_at = now()
  WHERE id = p_message_id
    AND sender_id = auth.uid()
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'You can only edit a message you sent';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.unsend_support_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.support_messages
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_message_id
    AND sender_id = auth.uid()
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'You can only unsend a message you sent';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_support_message(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unsend_support_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_support_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsend_support_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_support_message_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Support messages are retained for audit and cannot be hard-deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_support_message_delete ON public.support_messages;
CREATE TRIGGER trg_prevent_support_message_delete
BEFORE DELETE ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_support_message_delete();