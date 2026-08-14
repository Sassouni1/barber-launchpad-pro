CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own support conversation"
ON public.support_conversations FOR SELECT TO authenticated
USING (member_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Members create own support conversation"
ON public.support_conversations FOR INSERT TO authenticated
WITH CHECK (member_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update support conversations"
ON public.support_conversations FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete support conversations"
ON public.support_conversations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  read_by_member_at timestamptz,
  read_by_admin_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_support_messages_conversation_created
  ON public.support_messages (conversation_id, created_at);

CREATE INDEX idx_support_messages_member_unread
  ON public.support_messages (conversation_id)
  WHERE read_by_member_at IS NULL;

CREATE POLICY "View messages in own or all conversations"
ON public.support_messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id AND c.member_id = auth.uid()
  )
);

CREATE POLICY "Send messages in own or all conversations"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = support_messages.conversation_id AND c.member_id = auth.uid()
    )
  )
);

CREATE OR REPLACE FUNCTION public.touch_support_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_support_conversation
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_support_conversation();

CREATE OR REPLACE FUNCTION public.mark_support_messages_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  SELECT member_id INTO v_member
  FROM public.support_conversations
  WHERE id = p_conversation_id;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF auth.uid() = v_member THEN
    UPDATE public.support_messages
    SET read_by_member_at = now()
    WHERE conversation_id = p_conversation_id
      AND sender_id <> auth.uid()
      AND read_by_member_at IS NULL;
  ELSIF v_is_admin THEN
    UPDATE public.support_messages
    SET read_by_admin_at = now()
    WHERE conversation_id = p_conversation_id
      AND sender_id <> auth.uid()
      AND read_by_admin_at IS NULL;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_support_messages_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_support_messages_read(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;