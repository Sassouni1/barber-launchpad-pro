
DO $$
DECLARE
  qid uuid;
BEGIN
  -- ============ Live Client Part 1 ============
  UPDATE modules SET has_quiz=true WHERE id='582837c7-5a6e-4467-b0ff-36446de0e478';

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('582837c7-5a6e-4467-b0ff-36446de0e478','After spraying 99% alcohol on the scalp, what should you do before wiping it away?','multiple_choice',0) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'Apply adhesive before wiping',false,0),
    (qid,'Wait 15 minutes before wiping',false,1),
    (qid,'Let it work for about 45 seconds before wiping',true,2),
    (qid,'Immediately wipe it off',false,3);

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('582837c7-5a6e-4467-b0ff-36446de0e478','How should the underside of a skin system and a lace system be cleaned before attachment?','multiple_choice',1) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'Use alcohol on the lace system and oil on the skin base',false,0),
    (qid,'Use conditioner on both systems',false,1),
    (qid,'Use alcohol on the skin base; shampoo and deep-clean the lace system',true,2),
    (qid,'Skip cleaning because the adhesive will remove residue',false,3);

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('582837c7-5a6e-4467-b0ff-36446de0e478','What is the purpose of a dry fit and alignment marks before permanent placement?','multiple_choice',2) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'To make the adhesive dry faster',false,0),
    (qid,'To confirm the system''s position, center, and front-to-back fit before committing',true,1),
    (qid,'To permanently outline where the system must go',false,2),
    (qid,'To determine which cleaning product to use',false,3);

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('582837c7-5a6e-4467-b0ff-36446de0e478','Where should the scalp adhesive sit in relation to the front reference line?','multiple_choice',3) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'Directly on top of the reference line',false,0),
    (qid,'Several inches behind the reference line',false,1),
    (qid,'About a pencil''s distance above the reference line',true,2),
    (qid,'Only on the hair system, never on the scalp',false,3);

  -- ============ Live Client Part 2 ============
  UPDATE modules SET has_quiz=true WHERE id='7c4808e9-0b1e-40e8-b188-016d4f9398a4';

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('7c4808e9-0b1e-40e8-b188-016d4f9398a4','In this demonstration, why does he use pins while preparing the skin system?','multiple_choice',0) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'To stretch the system permanently',false,0),
    (qid,'To keep the system secure so it doesn''t fall into the adhesive or become contaminated',true,1),
    (qid,'To make the adhesive dry faster',false,2),
    (qid,'To mark the front hairline',false,3);

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('7c4808e9-0b1e-40e8-b188-016d4f9398a4','Before adding another coat or placing the system, what should you wait for?','multiple_choice',1) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'The adhesive to remain white and wet',false,0),
    (qid,'The adhesive to dry clear',true,1),
    (qid,'The adhesive to become completely hard',false,2),
    (qid,'A fixed 15-minute waiting period',false,3);

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('7c4808e9-0b1e-40e8-b188-016d4f9398a4','After placing the system onto the adhesive or tape, what should you do to help it bond properly?','multiple_choice',2) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'Let the system sit without touching it',false,0),
    (qid,'Spray alcohol over the front edge',false,1),
    (qid,'Press the system firmly so the adhesive bonds to the adhesive and the scalp',true,2),
    (qid,'Comb aggressively through the front hairline immediately',false,3);

  -- ============ Live Client Part 3 ============
  UPDATE modules SET has_quiz=true WHERE id='ef71fd79-972e-4aca-a6eb-771dfbb1b865';

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('ef71fd79-972e-4aca-a6eb-771dfbb1b865','Why should the hair system initially be left slightly longer than the desired finished length?','multiple_choice',0) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'Because system hair continues growing',false,0),
    (qid,'To leave room for blending, adjustments, and styling before taking more length off',true,1),
    (qid,'Because longer hair makes adhesive dry faster',false,2),
    (qid,'So the client cannot change the hairstyle later',false,3);

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('ef71fd79-972e-4aca-a6eb-771dfbb1b865','When blending the system hair with the client''s natural hair, what technique does he emphasize?','multiple_choice',1) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'Cut a thick section straight across at the root',false,0),
    (qid,'Use a razor aggressively against the scalp',false,1),
    (qid,'Use a thin section and cut it at a 45-degree angle with texturizing shears',true,2),
    (qid,'Cut everything to the shortest natural-hair length immediately',false,3);

  -- ============ Live Client Part 4 ============
  UPDATE modules SET has_quiz=true WHERE id='c8b69876-591a-41cc-82e4-755ad02efd4e';

  INSERT INTO quiz_questions (module_id, question_text, question_type, order_index)
  VALUES ('c8b69876-591a-41cc-82e4-755ad02efd4e','Why does he use texturizing shears to soften the front hairline?','multiple_choice',0) RETURNING id INTO qid;
  INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES
    (qid,'To create a sharper zigzag pattern',false,0),
    (qid,'To blur the straight edge while keeping it easier to recreate during maintenance',true,1),
    (qid,'To reduce the overall density of the system across the entire front',false,2),
    (qid,'To create a permanent transition between the system and the client''s natural hair',false,3);
END $$;
