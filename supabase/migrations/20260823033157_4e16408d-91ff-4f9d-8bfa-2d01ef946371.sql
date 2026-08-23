CREATE TABLE IF NOT EXISTS public.website_editor_entitlements (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_key text NOT NULL CHECK (template_key IN ('stay-faded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.website_editor_entitlements TO authenticated;
GRANT ALL ON public.website_editor_entitlements TO service_role;

ALTER TABLE public.website_editor_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their own website editor entitlement" ON public.website_editor_entitlements;
CREATE POLICY "Members can view their own website editor entitlement"
ON public.website_editor_entitlements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_website_editor_entitlements_updated_at ON public.website_editor_entitlements;
CREATE TRIGGER update_website_editor_entitlements_updated_at
BEFORE UPDATE ON public.website_editor_entitlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.member_websites
  ADD COLUMN IF NOT EXISTS editor_drafts jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  v_count integer;
  v_user uuid;
BEGIN
  SELECT count(*), min(id::text)::uuid INTO v_count, v_user
  FROM public.profiles
  WHERE lower(btrim(full_name)) = 'nikkole abila';

  IF v_count = 1 THEN
    INSERT INTO public.website_editor_entitlements (user_id, template_key)
    VALUES (v_user, 'stay-faded')
    ON CONFLICT (user_id) DO UPDATE SET template_key = 'stay-faded', updated_at = now();
  END IF;
END $$;