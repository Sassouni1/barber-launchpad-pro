import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `You are Aion, The Barber Launch Support AI. You help barbers who are learning hair system installation through an online training platform.

You have deep knowledge about:
- Hair system installation techniques (cutting, styling, bonding, adhesives, lace systems, skin systems)
- The certification process: complete required course modules, pass quizzes, submit certification photos for admin approval, then receive a certificate
- Course structure: courses contain modules, each module can have video lessons, downloadable files, notes, quizzes, and homework
- Group calls: live Zoom calls scheduled weekly for Q&A and demonstrations
- The rewards program: barbers can track client visits and offer loyalty rewards
- QR codes: used for marketing and client acquisition
- Orders: hair system ordering and tracking
- Common beginner questions about hair replacement, client consultations, and building a hair system business

Guidelines:
- Be encouraging, professional, and concise
- If you don't know something specific about the user's account, suggest they use the "Contact a Person" tab to reach the admin team
- Keep responses focused and actionable
- Use simple language — many users are new to hair systems
- Never make up specific platform features that don't exist
- When teaching concepts, use the curriculum knowledge below as your source of truth
- The CORRECT answers represent the factual knowledge you should teach
- The INCORRECT answers represent common misconceptions — you should gently correct users who express these misconceptions`;

async function buildCurriculumContext(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch courses
    const { data: courses } = await supabase
      .from("courses")
      .select("id, title, description, category")
      .eq("is_published", true)
      .order("order_index");

    if (!courses || courses.length === 0) return "";

    // Fetch modules
    const { data: modules } = await supabase
      .from("modules")
      .select("id, course_id, title, description")
      .eq("is_published", true)
      .order("order_index");

    // Fetch quiz questions with answers (including correct flags)
    const { data: questions } = await supabase
      .from("quiz_questions")
      .select("id, module_id, question_text, question_type")
      .order("order_index");

    const questionIds = questions?.map((q: any) => q.id) || [];
    let answers: any[] = [];
    if (questionIds.length > 0) {
      const { data } = await supabase
        .from("quiz_answers")
        .select("question_id, answer_text, is_correct")
        .in("question_id", questionIds)
        .order("order_index");
      answers = data || [];
    }

    // Build structured context
    let context = "\n\n--- PLATFORM CURRICULUM KNOWLEDGE ---\n";

    for (const course of courses) {
      context += `\n## Course: ${course.title}\n`;
      if (course.description) context += `${course.description}\n`;

      const courseModules = (modules || []).filter((m: any) => m.course_id === course.id);
      for (const mod of courseModules) {
        context += `\n### Module: ${mod.title}\n`;
        if (mod.description) context += `${mod.description}\n`;

        const modQuestions = (questions || []).filter((q: any) => q.module_id === mod.id);
        if (modQuestions.length > 0) {
          context += `\nKey knowledge from this module's quiz:\n`;
          for (const q of modQuestions) {
            context += `\nQ: ${q.question_text}\n`;
            const qAnswers = answers.filter((a: any) => a.question_id === q.id);
            const correct = qAnswers.filter((a: any) => a.is_correct);
            const incorrect = qAnswers.filter((a: any) => !a.is_correct);
            if (correct.length > 0) {
              context += `✅ CORRECT: ${correct.map((a: any) => a.answer_text).join("; ")}\n`;
            }
            if (incorrect.length > 0) {
              context += `❌ COMMON MISCONCEPTIONS: ${incorrect.map((a: any) => a.answer_text).join("; ")}\n`;
            }
          }
        }
      }
    }

    return context;
  } catch (e) {
    console.error("Failed to fetch curriculum context:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with real curriculum data
    const curriculumContext = await buildCurriculumContext();
    const systemPrompt = BASE_SYSTEM_PROMPT + curriculumContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm getting a lot of questions right now. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits have been exhausted. Please contact the admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Something went wrong with the AI service." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("member-help-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
