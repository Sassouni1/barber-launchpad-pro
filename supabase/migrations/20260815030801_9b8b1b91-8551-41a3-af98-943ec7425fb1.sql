CREATE TABLE public.support_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👍','❤️','😂','🎉','👀','🙏')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.support_message_reactions TO authenticated;
GRANT ALL ON public.support_message_reactions TO service_role;

ALTER TABLE public.support_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_support_message_reactions_conversation_created ON public.support_message_reactions(conversation_id, created_at);
CREATE INDEX idx_support_message_reactions_message_created ON public.support_message_reactions(message_id, created_at);

CREATE POLICY "Members and admins can view reactions in their conversations"
ON public.support_message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_message_reactions.conversation_id
      AND (c.member_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Members and admins can react to visible messages in their conversations"
ON public.support_message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_messages m
    JOIN public.support_conversations c ON c.id = m.conversation_id
    WHERE m.id = message_id
      AND m.conversation_id = support_message_reactions.conversation_id
      AND m.deleted_at IS NULL
      AND (c.member_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Users can only remove their own reactions"
ON public.support_message_reactions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_message_reactions;