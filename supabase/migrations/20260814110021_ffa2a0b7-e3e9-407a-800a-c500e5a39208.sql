ALTER TABLE public.aion_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aion_messages_message_type_check'
  ) THEN
    ALTER TABLE public.aion_messages
      ADD CONSTRAINT aion_messages_message_type_check CHECK (message_type IN ('text','image'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.aion_generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.aion_conversations(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  enhanced_prompt text,
  provider text NOT NULL,
  model text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  public_url text NOT NULL,
  width integer,
  height integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.aion_generated_images TO authenticated;
GRANT ALL ON public.aion_generated_images TO service_role;

ALTER TABLE public.aion_generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generated images"
  ON public.aion_generated_images FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated images"
  ON public.aion_generated_images FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_aion_generated_images_user_created
  ON public.aion_generated_images (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aion_generated_images_conversation_created
  ON public.aion_generated_images (conversation_id, created_at DESC);