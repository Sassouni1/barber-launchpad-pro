
CREATE TABLE public.aion_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.aion_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.aion_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.aion_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aion_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.aion_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.aion_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.aion_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.aion_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own messages" ON public.aion_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.aion_conversations WHERE id = aion_messages.conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own messages" ON public.aion_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.aion_conversations WHERE id = aion_messages.conversation_id AND user_id = auth.uid())
);

CREATE INDEX idx_aion_messages_conversation ON public.aion_messages(conversation_id, created_at);
CREATE INDEX idx_aion_conversations_user ON public.aion_conversations(user_id, updated_at DESC);
