-- Add a small, non-redundant practical quiz for Live Client Part 1.
-- The questions test the four setup decisions identified during transcript review.

DO $$
DECLARE
  v_module_id UUID;
  v_question_id UUID;
BEGIN
  SELECT id
    INTO v_module_id
    FROM public.modules
   WHERE title = 'Live Client Part 1'
   LIMIT 1;

  IF v_module_id IS NULL THEN
    RAISE EXCEPTION 'Live Client Part 1 module not found';
  END IF;

  UPDATE public.modules
     SET has_quiz = true
   WHERE id = v_module_id;

  SELECT id INTO v_question_id
    FROM public.quiz_questions
   WHERE module_id = v_module_id
     AND question_text = 'After spraying 99% alcohol on the scalp, what should you do before wiping it away?'
   LIMIT 1;
  IF v_question_id IS NULL THEN
    INSERT INTO public.quiz_questions (module_id, question_text, question_type, order_index)
    VALUES (v_module_id, 'After spraying 99% alcohol on the scalp, what should you do before wiping it away?', 'multiple_choice', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
      (v_question_id, 'Apply adhesive before wiping', false, 0),
      (v_question_id, 'Wait 15 minutes before wiping', false, 1),
      (v_question_id, 'Let it work for about 45 seconds before wiping', true, 2),
      (v_question_id, 'Immediately wipe it off', false, 3);
  END IF;

  v_question_id := NULL;
  SELECT id INTO v_question_id
    FROM public.quiz_questions
   WHERE module_id = v_module_id
     AND question_text = 'How should the underside of a skin system and a lace system be cleaned before attachment?'
   LIMIT 1;
  IF v_question_id IS NULL THEN
    INSERT INTO public.quiz_questions (module_id, question_text, question_type, order_index)
    VALUES (v_module_id, 'How should the underside of a skin system and a lace system be cleaned before attachment?', 'multiple_choice', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
      (v_question_id, 'Use alcohol on the skin base; shampoo and deep-clean the lace system', true, 0),
      (v_question_id, 'Use conditioner on both systems', false, 1),
      (v_question_id, 'Use alcohol on the lace and oil on the skin base', false, 2),
      (v_question_id, 'Skip cleaning because the adhesive will remove residue', false, 3);
  END IF;

  v_question_id := NULL;
  SELECT id INTO v_question_id
    FROM public.quiz_questions
   WHERE module_id = v_module_id
     AND question_text = 'What is the purpose of a dry fit and alignment marks before permanent placement?'
   LIMIT 1;
  IF v_question_id IS NULL THEN
    INSERT INTO public.quiz_questions (module_id, question_text, question_type, order_index)
    VALUES (v_module_id, 'What is the purpose of a dry fit and alignment marks before permanent placement?', 'multiple_choice', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
      (v_question_id, 'To confirm the system position, center, and front-to-back fit before committing', true, 0),
      (v_question_id, 'To make the adhesive dry faster', false, 1),
      (v_question_id, 'To decide which shampoo brand to use', false, 2),
      (v_question_id, 'To create a permanent outline that cannot be changed', false, 3);
  END IF;

  v_question_id := NULL;
  SELECT id INTO v_question_id
    FROM public.quiz_questions
   WHERE module_id = v_module_id
     AND question_text = 'Where should the scalp adhesive sit in relation to the front reference line?'
   LIMIT 1;
  IF v_question_id IS NULL THEN
    INSERT INTO public.quiz_questions (module_id, question_text, question_type, order_index)
    VALUES (v_module_id, 'Where should the scalp adhesive sit in relation to the front reference line?', 'multiple_choice', 3)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
      (v_question_id, 'About a pencil''s distance above the reference line', true, 0),
      (v_question_id, 'Directly on top of the reference line', false, 1),
      (v_question_id, 'Several inches behind the reference line', false, 2),
      (v_question_id, 'Only on the hair system, never on the scalp', false, 3);
  END IF;
END $$;
