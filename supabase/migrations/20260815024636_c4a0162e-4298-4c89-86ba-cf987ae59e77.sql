ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_body_check;
ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_body_check
  CHECK (
    length(btrim(body)) <= 4000
    AND (length(btrim(body)) >= 1 OR attachment_path IS NOT NULL)
  );

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_attachment_size_check
  CHECK (attachment_size IS NULL OR (attachment_size >= 1 AND attachment_size <= 10485760));

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_attachment_mime_check
  CHECK (attachment_mime_type IS NULL OR attachment_mime_type IN ('image/jpeg','image/png','image/webp','image/gif'));

ALTER TABLE public.support_message_events
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

DROP POLICY IF EXISTS "Support attachments readable by conversation member or admin" ON storage.objects;
CREATE POLICY "Support attachments readable by conversation member or admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'support-message-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.member_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Support attachments uploadable by conversation member or admin" ON storage.objects;
CREATE POLICY "Support attachments uploadable by conversation member or admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'support-message-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.member_id = auth.uid()
    )
  )
);

CREATE OR REPLACE FUNCTION public.log_support_message_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_message_events (
      message_id, conversation_id, actor_id, event_type, body, occurred_at,
      attachment_path, attachment_name, attachment_mime_type, attachment_size
    )
    VALUES (
      NEW.id, NEW.conversation_id, NEW.sender_id, 'sent', NEW.body, NEW.created_at,
      NEW.attachment_path, NEW.attachment_name, NEW.attachment_mime_type, NEW.attachment_size
    );
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body THEN
    INSERT INTO public.support_message_events (
      message_id, conversation_id, actor_id, event_type, body, previous_body,
      attachment_path, attachment_name, attachment_mime_type, attachment_size
    )
    VALUES (
      NEW.id, NEW.conversation_id, COALESCE(auth.uid(), NEW.sender_id), 'edited', NEW.body, OLD.body,
      NEW.attachment_path, NEW.attachment_name, NEW.attachment_mime_type, NEW.attachment_size
    );
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    INSERT INTO public.support_message_events (
      message_id, conversation_id, actor_id, event_type, body, previous_body, occurred_at,
      attachment_path, attachment_name, attachment_mime_type, attachment_size
    )
    VALUES (
      NEW.id, NEW.conversation_id, COALESCE(NEW.deleted_by, auth.uid()), 'unsent', OLD.body, OLD.body, NEW.deleted_at,
      OLD.attachment_path, OLD.attachment_name, OLD.attachment_mime_type, OLD.attachment_size
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.edit_support_message(p_message_id uuid, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_body text := btrim(coalesce(p_body, ''));
  v_has_attachment boolean;
  v_rows integer;
BEGIN
  SELECT attachment_path IS NOT NULL INTO v_has_attachment
  FROM public.support_messages
  WHERE id = p_message_id;

  IF v_body = '' AND COALESCE(v_has_attachment, false) = false THEN
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
$function$;