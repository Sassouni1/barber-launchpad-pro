
-- 1. Add flag to modules to identify the directory enrollment lesson
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS is_directory_enrollment boolean NOT NULL DEFAULT false;

-- 2. Create directory_photos table (gallery, with hero flag + proof flag)
CREATE TABLE IF NOT EXISTS public.directory_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid REFERENCES public.specialist_directory(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_path text NOT NULL,
  is_hero boolean NOT NULL DEFAULT false,
  is_proof boolean NOT NULL DEFAULT false,
  caption text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.directory_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own directory photos"
ON public.directory_photos FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all directory photos"
ON public.directory_photos FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view photos of approved visible listings"
ON public.directory_photos FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.specialist_directory s
    WHERE s.id = directory_photos.listing_id
      AND s.approved = true
      AND s.visible = true
  )
);

CREATE INDEX IF NOT EXISTS idx_directory_photos_listing ON public.directory_photos(listing_id);
CREATE INDEX IF NOT EXISTS idx_directory_photos_user ON public.directory_photos(user_id);

-- 3. Insert the new lesson module at the end of Hair System Mastery course
INSERT INTO public.modules (
  course_id, title, description, order_index,
  is_published, is_certification_requirement, is_directory_enrollment
) VALUES (
  'a2810c27-f8f3-4930-8ae9-a6f5f659d097',
  'Get Added to the Men''s Hair Expert Search Database',
  'Take a photo holding your certification and upload it to get added to the public Men''s Hair Expert Search Database at find.menshairexpert.com.',
  16,
  true,
  false,
  true
);
