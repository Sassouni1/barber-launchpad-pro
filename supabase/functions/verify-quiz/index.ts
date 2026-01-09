import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a client with the user's token to get their identity
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Failed to get user:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { moduleId, answers } = await req.json();
    console.log(`Processing quiz submission for user ${user.id}, module ${moduleId}`);
    console.log(`Received ${answers?.length || 0} answers`);

    if (!moduleId || !answers || !Array.isArray(answers)) {
      console.error('Invalid request body:', { moduleId, answers });
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get questions for this module
    const { data: questions, error: questionsError } = await supabase
      .from('quiz_questions')
      .select('id')
      .eq('module_id', moduleId);

    if (questionsError) {
      console.error('Failed to fetch questions:', questionsError);
      throw questionsError;
    }

    const questionIds = questions.map(q => q.id);
    console.log(`Found ${questionIds.length} questions for module`);

    // Get all correct answers for these questions (server-side access to full table)
    const { data: correctAnswers, error: answersError } = await supabase
      .from('quiz_answers')
      .select('id, question_id, is_correct')
      .in('question_id', questionIds)
      .eq('is_correct', true);

    if (answersError) {
      console.error('Failed to fetch correct answers:', answersError);
      throw answersError;
    }

    console.log(`Found ${correctAnswers.length} correct answers`);

    // Build a map of question_id -> correct_answer_id
    const correctAnswerMap: Record<string, string> = {};
    for (const answer of correctAnswers) {
      correctAnswerMap[answer.question_id] = answer.id;
    }

    // Calculate score and determine which answers were correct
    let score = 0;
    const responses: { questionId: string; selectedAnswerId: string; isCorrect: boolean }[] = [];

    for (const answer of answers) {
      const correctAnswerId = correctAnswerMap[answer.questionId];
      const isCorrect = correctAnswerId === answer.selectedAnswerId;
      if (isCorrect) score++;

      responses.push({
        questionId: answer.questionId,
        selectedAnswerId: answer.selectedAnswerId,
        isCorrect,
      });
    }

    console.log(`Quiz score: ${score}/${questions.length}`);

    // Insert the quiz attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('user_quiz_attempts')
      .insert({
        user_id: user.id,
        module_id: moduleId,
        score,
        total_questions: questions.length,
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Failed to insert attempt:', attemptError);
      throw attemptError;
    }

    console.log(`Created attempt ${attempt.id}`);

    // Insert individual responses for tracking
    const responsesToInsert = responses.map(r => ({
      attempt_id: attempt.id,
      question_id: r.questionId,
      selected_answer_id: r.selectedAnswerId,
      is_correct: r.isCorrect,
    }));

    const { error: responsesError } = await supabase
      .from('user_quiz_responses')
      .insert(responsesToInsert);

    if (responsesError) {
      console.error('Failed to save quiz responses:', responsesError);
      // Don't throw - the attempt was saved successfully
    }

    // Return the score and the correct answer map for review
    return new Response(JSON.stringify({
      attemptId: attempt.id,
      score,
      total: questions.length,
      correctAnswers: correctAnswerMap, // { questionId: correctAnswerId }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in verify-quiz:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
