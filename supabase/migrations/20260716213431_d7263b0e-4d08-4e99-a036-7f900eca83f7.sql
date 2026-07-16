
DO $$
DECLARE
  qid uuid;
BEGIN
  -- ================= LIVE CLIENT PART 2 (module 7c4808e9-0b1e-40e8-b188-016d4f9398a4) =================

  -- Q4
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('7c4808e9-0b1e-40e8-b188-016d4f9398a4',
          'Why does the instructor brush the scalp adhesive left-right, forward-backward and diagonally instead of one direction?',
          3)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'To fill more pores of the scalp so the adhesive contacts more surface area', true, 0),
    (qid, 'To thin the adhesive out so it dries clear faster', false, 1),
    (qid, 'To warm the adhesive with friction before placing the system', false, 2),
    (qid, 'To keep the client entertained during the wait', false, 3);

  -- Q5
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('7c4808e9-0b1e-40e8-b188-016d4f9398a4',
          'Why does he recommend cutting the system down out of the client''s view in a back room?',
          4)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'To keep parts of the process private so clients keep coming back for service', true, 0),
    (qid, 'Because bright lighting is needed that isn''t available at the chair', false, 1),
    (qid, 'To avoid getting hair pieces on the client''s clothing', false, 2),
    (qid, 'Because state boards require it', false, 3);

  -- Q6
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('7c4808e9-0b1e-40e8-b188-016d4f9398a4',
          'While laying the system down, why does he pull sideways and slightly toward himself?',
          5)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'To keep the base just taut enough that no wrinkles form (without stretching it)', true, 0),
    (qid, 'To stretch the base tight so it covers a larger area of the head', false, 1),
    (qid, 'To let extra adhesive squeeze out toward the front hairline', false, 2),
    (qid, 'So the tag in the back peels off before placement', false, 3);

  -- Q7
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('7c4808e9-0b1e-40e8-b188-016d4f9398a4',
          'How should the small reference line still visible in front be cleaned off after the system is placed?',
          6)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'Barely dab it with alcohol on a towel from a safe distance so the front bond isn''t pulled up', true, 0),
    (qid, 'Scrub the front edge firmly with alcohol until every mark is gone', false, 1),
    (qid, 'Peel the front up, wipe underneath, and press it back down', false, 2),
    (qid, 'Leave the marks — they''ll grow out with the client''s hair', false, 3);

  -- ================= LIVE CLIENT PART 3 (module ef71fd79-972e-4aca-a6eb-771dfbb1b865) =================

  -- Q3
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('ef71fd79-972e-4aca-a6eb-771dfbb1b865',
          'What quick bulk-removal cut does he start the haircut with?',
          2)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'A mohawk section down the center to remove roughly 90% of the length in a few cuts', true, 0),
    (qid, 'A perimeter clipper-over-comb pass around the entire hairline', false, 1),
    (qid, 'A tight fade on the sides first, then he blends the top down', false, 2),
    (qid, 'A single guard-2 pass over the whole system', false, 3);

  -- Q4
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('ef71fd79-972e-4aca-a6eb-771dfbb1b865',
          'What angle and section of the hair does he target with texturizing shears to blend?',
          3)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'About 45 degrees, cutting mid-strand to ends', true, 0),
    (qid, '90 degrees straight up, cutting right at the base', false, 1),
    (qid, 'Flat against the head, cutting only the tips', false, 2),
    (qid, '45 degrees, cutting as close to the root as possible', false, 3);

  -- Q5
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('ef71fd79-972e-4aca-a6eb-771dfbb1b865',
          'Why does he texturize the client''s own side hair instead of clippering it very short?',
          4)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'The client''s density is low, so cutting too short would expose too much scalp', true, 0),
    (qid, 'Clippers would damage the front edge of the hair system', false, 1),
    (qid, 'Texturizing shears are the only tool that can create a fade', false, 2),
    (qid, 'The client asked for a completely uniform length everywhere', false, 3);

  -- Q6
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('ef71fd79-972e-4aca-a6eb-771dfbb1b865',
          'When pulling the center mohawk section up to cut it, why does he keep his fingers shallow instead of buried deep in the hair?',
          5)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'Fingers buried deep pull one side around and make that side end up longer than the other', true, 0),
    (qid, 'Shallow fingers give a cleaner grip on the hair system tape tabs', false, 1),
    (qid, 'It keeps the adhesive from bonding to the fingers', false, 2),
    (qid, 'Deep fingers would break the shear blade tension', false, 3);

  -- ================= LIVE CLIENT PART 4 (module c8b69876-591a-41cc-82e4-755ad02efd4e) =================

  -- Q2
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('c8b69876-591a-41cc-82e4-755ad02efd4e',
          'Why does he blur the front hairline with texturizing shears instead of cutting little V''s into the system itself?',
          1)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'A zigzag/jagged edge in the system is very hard to recreate at future reinstalls, but a blurred straight line is easy to match', true, 0),
    (qid, 'V''s in the base weaken the front and cause the system to lift', false, 1),
    (qid, 'Texturizing shears are the only tool sharp enough to cut the base', false, 2),
    (qid, 'It saves the client money by using less hair', false, 3);

  -- Q3
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('c8b69876-591a-41cc-82e4-755ad02efd4e',
          'When cleaning around the beard and sideburns, what does he mean by "crossing the line"?',
          2)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'Any hair that grows past the natural line of the client''s facial-hair shape', true, 0),
    (qid, 'Hair that crosses the center part on top of the head', false, 1),
    (qid, 'Hair that goes past the front edge of the hair system', false, 2),
    (qid, 'Any hair longer than one clipper guard setting', false, 3);

  -- Q4
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('c8b69876-591a-41cc-82e4-755ad02efd4e',
          'How does he manage the client''s expectations about the fade?',
          3)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'He tells the client he doesn''t really do fades, then delivers a slight fade so the client gets more than expected', true, 0),
    (qid, 'He promises the tightest fade possible and delivers exactly that', false, 1),
    (qid, 'He refuses to fade at all and only cuts scissor-over-comb', false, 2),
    (qid, 'He charges extra for the fade upfront so the client commits', false, 3);

  -- Q5
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('c8b69876-591a-41cc-82e4-755ad02efd4e',
          'What is his standard step-by-step haircut sequence on an install?',
          4)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'Mohawk strip down the center, pie-section the bangs, pie-section around to the back, then texturize the sides (system + client hair)', true, 0),
    (qid, 'Fade the sides first, then clipper the top to one length, then texturize', false, 1),
    (qid, 'Wet cut the entire system to finished length before touching the client''s hair', false, 2),
    (qid, 'Cut the client''s hair to final length, then trim the system to match', false, 3);

  -- Q6
  INSERT INTO public.quiz_questions (module_id, question_text, order_index)
  VALUES ('c8b69876-591a-41cc-82e4-755ad02efd4e',
          'Why does he intentionally leave the first cut a little bit longer than the final look?',
          5)
  RETURNING id INTO qid;
  INSERT INTO public.quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid, 'Clients aren''t used to having hair — leave it long, then bring them back in a day or two to remove more', true, 0),
    (qid, 'Longer hair helps the adhesive cure faster', false, 1),
    (qid, 'It''s required to keep the certification valid', false, 2),
    (qid, 'The hair system continues to grow slightly after installation', false, 3);

END $$;
