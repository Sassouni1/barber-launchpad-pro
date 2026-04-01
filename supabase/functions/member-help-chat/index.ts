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

## RESPONSE FORMAT

You're a coach talking to a real person, not a template filling itself in. Match your format to what they actually need.

### How to open
Always start by reacting to what they said. 1-2 sentences that show you actually heard them. Reframe their problem, validate their feeling, or challenge their assumption. THEN give structure.

### How to structure
- Use **bold numbered titles** for action items (e.g. "**1. Update your bio right now ⚡**") — NOT ### markdown headings. Lighter, more like texting.
- Mix paragraphs, bullets, and numbered sections naturally. Don't force everything into one format.
- Short paragraphs (1-3 sentences) between structured sections. White space matters.
- Max 3 action items when giving advice. If they need more, tell them to come back after doing these 3.
- When telling them to do something specific (update a bio, talk to a client, send a DM), give them the EXACT words to copy-paste.

### How to close
End with a direct question or challenge on its own line. No labels like "Coach check-in:" — just ask naturally. Make it specific to something from their checklist or situation.

### Length
Match your depth to their question. Simple question = short answer. Complex or emotional question = detailed breakdown. Don't pad short answers. Don't truncate important ones.

### Tone
- Talk like a coach texting, not writing a blog post. Direct. Short sentences. Strong opinions.
- Use "you" language: "Your constraint is volume, not talent" not "One's constraint is often volume."
- No motivational filler unless they specifically ask for encouragement.
- Have a clear point of view. Don't hedge everything.

### BAD (never do this):
### 1. Update Your Instagram Bio ⚡
Go to your Instagram/Facebook bio now and add "Hair System Specialist." If it's not in your bio, you don't officially offer the service in the eyes of a lead.

---
**Coach check-in:** Have you added a "Free Consultation" button to your booking app yet?

### GOOD (do this):
You're overthinking this. The fastest way to get a client this week isn't a perfect Instagram page — it's opening your mouth.

**1. Tell every person in your chair today**
"Hey, I'm now doing hair replacement systems for men. Know anyone dealing with thinning?" That's it. Say it to every single client today.

**2. Update your bio right now ⚡**
Add "Hair System Specialist" and a "Book Free Consultation" link. If it's not in your bio, you don't officially offer it.

**3. DM 10 people on Facebook tonight**
Not a sales pitch. Just: "Hey, wanted to let you know I'm now offering hair systems for men dealing with hair loss. Know anyone who might be interested?"

Have you set up a "Free Consultation" option in your booking app yet? That's the thing that turns all this activity into actual booked clients.

## OTHER GUIDELINES
- If you don't know something specific about the user's account, suggest they use the "Contact a Person" tab to reach the admin team
- Use simple language — many users are new to hair systems
- Never make up specific platform features that don't exist
- When teaching concepts, use the curriculum knowledge below as your source of truth
- The CORRECT answers represent the factual knowledge you should teach
- The INCORRECT answers represent common misconceptions — gently correct users who express these misconceptions`;

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function buildCurriculumContext(): Promise<string> {
  const supabase = getSupabaseAdmin();

  try {
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

async function buildUserContext(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  try {
    // Fetch profile, quiz attempts, todo progress, and dynamic todo progress in parallel
    const [profileRes, quizAttemptsRes, todoProgressRes, dynamicProgressRes] = await Promise.all([
      supabase.from("profiles").select("full_name, created_at").eq("id", userId).single(),
      supabase.from("user_quiz_attempts").select("module_id, score, total_questions, completed_at").eq("user_id", userId).order("completed_at", { ascending: false }),
      supabase.from("user_todos").select("todo_id, completed, completed_at").eq("user_id", userId),
      supabase.from("user_dynamic_todo_progress").select("item_id, completed, completed_at").eq("user_id", userId),
    ]);

    let context = "\n\n--- THIS MEMBER'S PERSONAL PROGRESS ---\n";

    // Name & join date
    const profile = profileRes.data;
    if (profile) {
      const firstName = profile.full_name?.split(" ")[0] || "there";
      context += `\nMember name: ${profile.full_name || "Unknown"} (call them "${firstName}")\n`;
      const joinDate = new Date(profile.created_at);
      const daysSinceJoin = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
      context += `Joined: ${joinDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} (${daysSinceJoin} days ago)\n`;
    }

    // Quiz progress — fetch module titles for context
    const quizAttempts = quizAttemptsRes.data || [];
    if (quizAttempts.length > 0) {
      const moduleIds = [...new Set(quizAttempts.map((a: any) => a.module_id))];
      const { data: modulesData } = await supabase
        .from("modules")
        .select("id, title")
        .in("id", moduleIds);
      const moduleMap = new Map((modulesData || []).map((m: any) => [m.id, m.title]));

      context += `\nQuiz results:\n`;
      // Show best attempt per module
      const bestByModule = new Map<string, any>();
      for (const attempt of quizAttempts) {
        const existing = bestByModule.get(attempt.module_id);
        if (!existing || attempt.score > existing.score) {
          bestByModule.set(attempt.module_id, attempt);
        }
      }
      for (const [moduleId, attempt] of bestByModule) {
        const title = moduleMap.get(moduleId) || "Unknown module";
        const passed = attempt.score >= Math.ceil(attempt.total_questions * 0.8);
        context += `  - ${title}: ${attempt.score}/${attempt.total_questions} ${passed ? "✅ PASSED" : "❌ NOT YET PASSED"}\n`;
      }
    } else {
      context += `\nQuiz results: No quizzes taken yet.\n`;
    }

    // Dynamic to-do progress (the main checklist stages)
    const dynamicProgress = dynamicProgressRes.data || [];
    if (dynamicProgress.length > 0) {
      // Fetch all items and lists to map progress
      const [listsRes, itemsRes] = await Promise.all([
        supabase.from("dynamic_todo_lists").select("id, title, order_index").order("order_index"),
        supabase.from("dynamic_todo_items").select("id, list_id, title").order("order_index"),
      ]);
      const lists = listsRes.data || [];
      const items = itemsRes.data || [];
      const completedIds = new Set(dynamicProgress.filter((p: any) => p.completed).map((p: any) => p.item_id));

      context += `\nTo-Do Checklist progress:\n`;
      for (const list of lists) {
        const listItems = items.filter((i: any) => i.list_id === list.id);
        const done = listItems.filter((i: any) => completedIds.has(i.id)).length;
        const total = listItems.length;
        if (total === 0) continue;
        context += `  Stage "${list.title}": ${done}/${total} tasks done`;
        if (done === total) context += " ✅ COMPLETE";
        else if (done === 0) context += " (not started)";
        context += "\n";

        // Show incomplete tasks so Aion can reference them
        if (done < total) {
          const incomplete = listItems.filter((i: any) => !completedIds.has(i.id));
          for (const item of incomplete.slice(0, 5)) {
            context += `    ⬜ ${item.title}\n`;
          }
          if (incomplete.length > 5) {
            context += `    ... and ${incomplete.length - 5} more\n`;
          }
        }
      }
    } else {
      context += `\nTo-Do Checklist progress: No tasks completed yet (brand new member).\n`;
    }

    context += `\nUSE THIS DATA to personalize your responses. Reference their actual progress, incomplete tasks, and quiz results. Call them by their first name.\n`;

    return context;
  } catch (e) {
    console.error("Failed to fetch user context:", e);
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

    // Extract user from auth token
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      } catch { /* proceed without user context */ }
    }

    // Build system prompt with curriculum + user-specific data in parallel
    const [curriculumContext, userContext] = await Promise.all([
      buildCurriculumContext(),
      userId ? buildUserContext(userId) : Promise.resolve(""),
    ]);
    const systemPrompt = BASE_SYSTEM_PROMPT + curriculumContext + userContext;

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
