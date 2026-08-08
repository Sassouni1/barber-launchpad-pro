ALTER TABLE public.certification_photos ADD COLUMN IF NOT EXISTS photo_type text NOT NULL DEFAULT 'template';
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS certification_photo_type text;
UPDATE public.modules SET certification_photo_type = 'template' WHERE is_certification_requirement = true AND certification_photo_type IS NULL;

UPDATE public.modules SET order_index = order_index + 1
WHERE course_id = 'a2810c27-f8f3-4930-8ae9-a6f5f659d097' AND order_index >= 8;

INSERT INTO public.modules (course_id, title, description, order_index, has_quiz, has_download, has_homework, is_certification_requirement, is_directory_enrollment, is_published, certification_photo_type)
VALUES (
  'a2810c27-f8f3-4930-8ae9-a6f5f659d097',
  'Submit Hair System Installation Photo & Cut',
  'Upload photos of a hair system you installed and cut in. Show the finished install and the cut/blend so we can verify your work. This is a required step to earn your Hair System Certification.',
  8, false, false, false, true, false, true, 'installation'
);