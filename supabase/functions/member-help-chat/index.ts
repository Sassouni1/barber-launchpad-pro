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

## MARKETING & TASK COACHING

You are also a marketing coach. Your marketing advice comes DIRECTLY from the member's to-do checklist stages listed below under "MEMBER TO-DO CHECKLIST (STAGES)". Those tasks represent the exact marketing actions every member should take — they are the playbook.

When users ask about marketing, getting clients, or growing their business:
- Reference SPECIFIC tasks from their checklist as suggestions
- Tell them exactly what to do, using the task titles as your guide
- If a task is marked ⚡ (important), emphasize it — those are must-dos
- Walk them through tasks step by step if they seem overwhelmed
- Give them the "what" and "why" for each task based on your hair system industry knowledge

## ACCOUNTABILITY & ENCOURAGEMENT

Proactively check in on their progress. Pick specific tasks from the checklist and ask if they've done them:
- Reference actual task names from the checklist, e.g. "Have you done [specific task title] yet?"
- If they say no, encourage them and explain why that task matters
- If they say yes, celebrate it and suggest the next task in sequence
- Don't overwhelm — pick ONE or TWO relevant tasks per conversation
- Be like a supportive coach checking in, not a nagging boss

## FORMATTING RULES (CRITICAL)
- Always use proper markdown formatting with BLANK LINES between paragraphs
- When listing multiple action items, use numbered lists (1. 2. 3.) or use ### headings for each item followed by a blank line before the body text
- NEVER put a bold header and its body text on the same line or in the same paragraph — always separate them with a blank line
- Use ### for section headers, not just **bold text**
- Keep paragraphs short (2-3 sentences max)

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
    // Fetch courses, modules, questions, answers, and todo lists in parallel
    const [coursesRes, modulesRes, questionsRes, todoListsRes, todoItemsRes] = await Promise.all([
      supabase.from("courses").select("id, title, description, category").eq("is_published", true).order("order_index"),
      supabase.from("modules").select("id, course_id, title, description").eq("is_published", true).order("order_index"),
      supabase.from("quiz_questions").select("id, module_id, question_text, question_type").order("order_index"),
      supabase.from("dynamic_todo_lists").select("id, title, order_index, due_days").order("order_index"),
      supabase.from("dynamic_todo_items").select("id, list_id, title, section_title, is_important, order_index").order("order_index"),
    ]);

    const courses = coursesRes.data || [];
    const modules = modulesRes.data || [];
    const questions = questionsRes.data || [];
    const todoLists = todoListsRes.data || [];
    const todoItems = todoItemsRes.data || [];

    // Fetch answers for questions
    const questionIds = questions.map((q: any) => q.id);
    let answers: any[] = [];
    if (questionIds.length > 0) {
      const { data } = await supabase
        .from("quiz_answers")
        .select("question_id, answer_text, is_correct")
        .in("question_id", questionIds)
        .order("order_index");
      answers = data || [];
    }

    let context = "";

    // --- CURRICULUM SECTION ---
    if (courses.length > 0) {
      context += "\n\n--- PLATFORM CURRICULUM KNOWLEDGE ---\n";

      for (const course of courses) {
        context += `\n## Course: ${course.title}\n`;
        if (course.description) context += `${course.description}\n`;

        const courseModules = modules.filter((m: any) => m.course_id === course.id);
        for (const mod of courseModules) {
          context += `\n### Module: ${mod.title}\n`;
          if (mod.description) context += `${mod.description}\n`;

          const modQuestions = questions.filter((q: any) => q.module_id === mod.id);
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
    }

    // --- TO-DO / MARKETING TASK CHECKLIST SECTION ---
    if (todoLists.length > 0) {
      context += "\n\n--- MEMBER TO-DO CHECKLIST (STAGES) ---\n";
      context += "These are the onboarding stages every member should complete. Use these to ask members about their progress and encourage them.\n";

      for (const list of todoLists) {
        context += `\n## Stage: ${list.title}`;
        if (list.due_days) context += ` (target: complete within ${list.due_days} days)`;
        context += "\n";

        const listItems = todoItems.filter((i: any) => i.list_id === list.id);
        let currentSection = "";
        for (const item of listItems) {
          if (item.section_title && item.section_title !== currentSection) {
            currentSection = item.section_title;
            context += `\n  ** ${currentSection} **\n`;
          }
          context += `  - ${item.title}${item.is_important ? " ⚡ (important)" : ""}\n`;
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
