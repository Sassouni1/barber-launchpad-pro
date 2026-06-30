
INSERT INTO public.modules (id, course_id, title, description, video_url, duration, has_download, has_homework, has_quiz, is_published, order_index)
VALUES (
  'c1100000-0000-4000-8000-000000000001'::uuid,
  'b431323d-f61e-4447-baaa-a70467cac4ac',
  'Go High Level', '', NULL, '',
  false, false, false, true, 21
);

INSERT INTO public.lessons (id, module_id, title, description, video_url, duration, type, has_download, has_homework, has_quiz, order_index)
VALUES
('c1100000-0000-4000-8000-000000000101'::uuid,
 'c1100000-0000-4000-8000-000000000001'::uuid,
 'What is Go High Level', '',
 'https://vimeo.com/1205898380/12eb8971a0?share=copy&fl=sv&fe=ci',
 '', 'video', false, false, false, 0),
('c1100000-0000-4000-8000-000000000102'::uuid,
 'c1100000-0000-4000-8000-000000000001'::uuid,
 'Why GHL is Important and Basics', '',
 NULL, '', 'video', false, false, false, 1);
