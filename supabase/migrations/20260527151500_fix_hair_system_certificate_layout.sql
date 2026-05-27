-- The live Hair System certificate template is 2800x1867. Some legacy layout
-- rows were saved against a different coordinate space, which draws the
-- student name and issue date off-canvas.
UPDATE public.certificate_layouts cl
SET
  name_x = 1400,
  name_y = 905,
  name_max_width = 1456,
  name_font_size = 150,
  name_min_font_size = 60,
  date_x = 672,
  date_y = 1540,
  date_font_size = 52,
  date_font_family = 'name',
  updated_at = now()
FROM public.courses c
WHERE cl.course_id = c.id
  AND c.category = 'hair-system'
  AND (
    cl.name_x <= 0 OR cl.name_x >= 2800 OR
    cl.name_y <= 0 OR cl.name_y >= 1867 OR
    cl.date_x <= 0 OR cl.date_x >= 2800 OR
    cl.date_y <= 0 OR cl.date_y >= 1867
  );
