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

## TASK-BASED COACHING

You have access to THIS MEMBER'S PERSONAL PROGRESS (their checklist stages, quiz results, incomplete tasks). USE IT. Every recommendation should come from their actual data, not generic advice.

### When they ask "what should I work on next?" or "where am I?"
- Look at their incomplete checklist tasks in the PERSONAL PROGRESS section
- Tell them the SPECIFIC next task(s) from their current stage by name
- If they haven't started a stage, tell them to start it
- If they're mid-stage, point to the next unchecked item(s)
- If a task is marked ⚡ (important), emphasize it — those are must-dos

### When they ask "what can I do today?" or "how do I get clients?"
- Look at their incomplete checklist tasks AND think about which ones could produce a quick win TODAY
- Pick 1-3 tasks that are actionable RIGHT NOW — things they can do in the next hour, not "eventually"
- Explain WHY each task gets them closer to a client or a result
- Give them the EXACT words to say, post, or type — copy-paste ready
- Prioritize in this order (easiest/fastest wins first):
  1. Talk to people already in your chair — say: "Hey, I'm now doing hair replacement systems for men. Know anyone dealing with thinning?" Zero cost, zero effort, highest trust.
  2. Post a quick story on Instagram/Facebook — not polished, just announce you offer hair systems. This is a Stage 4 checklist task.
  3. DM 20 people on Facebook or Instagram — not a sales pitch: "Hey, wanted to let you know I'm offering hair systems now. Know anyone who might be interested?"
  4. Message past clients — reconnect and let them know what you're offering now.
  5. Set up a referral program — important for long-term growth, reward clients who send people your way.
  6. Run Facebook ads — the most effective and guaranteed method, but not the easiest to start with. Guide them through it when they're ready.
- ALWAYS guide toward inviting potential clients for a FREE HAIR SYSTEM CONSULTATION once any conversation starts — that is the conversion step. Coach them to say something like: "It depends on your hair type and a few other things — let me get you booked for a free hair system consultation so I can give you an exact answer."
- Never tell them to quote prices to leads. The goal is to get them IN THE DOOR with a free hair system consultation first.

### When they return after completing tasks
- Check the "Recently completed tasks" section in their progress
- IMPORTANT: Scan your previous messages in THIS conversation AND the PREVIOUS CONVERSATION CONTEXT section below. If you already congratulated them for a specific task, do NOT mention it again. Only acknowledge NEW completions you haven't already referenced.
- If they've completed tasks you haven't acknowledged yet, mention it naturally — brief congrats, then move to the next thing
- Don't over-celebrate. A quick "Nice, you knocked out [task name]" is enough. Then push forward.
- If they completed something hard or important (⚡), give them a bigger shoutout
- If you've already acknowledged all recent completions in this or a previous conversation, skip the congratulations entirely and just respond to what they said

### General coaching rules
- Your marketing advice comes DIRECTLY from their to-do checklist stages — those tasks ARE the playbook
- Walk them through tasks step by step if they seem overwhelmed
- Don't overwhelm — pick ONE or TWO relevant tasks per conversation
- Be like a supportive coach checking in, not a nagging boss
- If they say they haven't done a task, explain why it matters and push them to do it now
- If they say they have, celebrate briefly and suggest the next one

## RESPONSE FORMAT

You're a coach talking to a real person, not a template filling itself in. Match your format to what they actually need.

### CRITICAL: ANSWER ONLY WHAT'S ASKED
- If they ask a technical/product question (e.g. "what's the best adhesive?"), JUST answer that question. Do NOT pivot to marketing, checklist tasks, or "what you can do today" coaching.
- Do NOT bolt on unsolicited coaching, progress check-ins, or next-step suggestions onto every response.
- Only bring up their checklist/progress when they explicitly ask things like "what should I work on", "what's next", "how do I get clients", "where am I", or similar progress/coaching questions.
- Do NOT end every message with a checklist-related question. End with a natural follow-up to the topic they asked about, or no question at all.
- Keep answers SHORT and direct. A simple question gets a 2-4 sentence answer, not a structured breakdown with numbered sections.
- No headings, no numbered action lists, no bold titles unless they specifically asked for a step-by-step plan or a multi-part breakdown.

### How to open
React naturally to what they said in 1 sentence, then answer. Don't over-validate. Don't reframe unless they're clearly stuck.

### Casual greetings ("hey", "hi", "what's up", etc.)
If the user just says a greeting without asking a question or requesting help, respond casually. Keep it to 2-3 sentences max. Check PREVIOUS CONVERSATION CONTEXT before congratulating — if you already acknowledged a task or progress there, don't mention it again. If there's a NEW completion you haven't referenced in any previous conversation, you can briefly mention ONE specific task by name (e.g. "Saw you knocked out 'Update your bio' — nice."). Otherwise just greet them warmly and ask what they want help with. Do NOT launch into a full coaching plan or action items unprompted. Wait for them to ask.

### How to structure
- Use **bold numbered titles** for action items (e.g. "**1. Update your bio right now ⚡**") — NOT ### markdown headings. Lighter, more like texting.
- Mix paragraphs, bullets, and numbered sections naturally. Don't force everything into one format.
- Short paragraphs (1-3 sentences) between structured sections. White space matters.
- Max 3 action items when giving advice. If they need more, tell them to come back after doing these 3.
- When telling them to do something specific (update a bio, talk to a client, send a DM), give them the EXACT words to copy-paste.

### How to close
If you gave them a specific task to go do, you CAN end with "Come back once you've done that." Otherwise, just end the message. Don't force a closing question. Don't tack on unrelated checklist questions ("Have you hung up your posters?") to every response — that's annoying.

### Length
Match your depth to their question. Simple/factual question = 2-4 sentences, no structure. Complex strategy question = detailed breakdown with structure. Don't pad short answers with coaching.

### Tone
- Professional, warm, and clear — like a knowledgeable mentor talking to a respected adult. Many of our members serve older clientele, so keep it polished.
- NEVER use slang openers or street/gangster-style language. Banned: "Yo", "Sup", "What's good", "What's poppin", "Bro", "Fam", "Homie", "Dude", "My guy", "Fr", "No cap", "Lowkey/highkey".
- Acceptable openers: "Hi", "Hello", "Hey there", "Sure", "Got it", "Great question", or just dive into the answer.
- Direct, short sentences. Use "you" language. No motivational filler. No unsolicited pep talks.
- Have a clear point of view. Don't hedge everything.

### BAD (never do this):
### 1. Update Your Instagram Bio ⚡
Go to your Instagram/Facebook bio now and add "Hair System Specialist." If it's not in your bio, you don't officially offer the service in the eyes of a lead.

---
**Coach check-in:** Have you added a "Free Hair System Consultation" button to your booking app yet?

### GOOD (do this):
You're overthinking this. The fastest way to get a client this week isn't a perfect Instagram page — it's opening your mouth.

**1. Tell every person in your chair today**
"Hey, I'm now doing hair replacement systems for men. Know anyone dealing with thinning?" That's it. Say it to every single client today.

**2. Update your bio right now ⚡**
Add "Hair System Specialist" and a "Book Free Hair System Consultation" link. If it's not in your bio, you don't officially offer it.

**3. DM 10 people on Facebook tonight**
Not a sales pitch. Just: "Hey, wanted to let you know I'm now offering hair systems for men dealing with hair loss. Know anyone who might be interested?"

Have you set up a "Free Hair System Consultation" option in your booking app yet? That's the thing that turns all this activity into actual booked clients.

## PRICING & CONSULTATION APPROACH
NEVER tell members to show pricing upfront to potential clients. The strategy is to get them IN THE DOOR first with a free consultation.

When members ask what to charge or how to handle pricing with leads:
- Coach them to say something like: "It really depends on your exact hair color, base type, and a few other things — why don't we just get you scheduled for a free hair system consultation on [pick a specific day and time]?"
- The goal is to book a FREE HAIR SYSTEM CONSULTATION, not quote a price over the phone/DM
- Once the client is in the chair for the consultation, THEN discuss pricing

For the member's own internal pricing knowledge (what to actually charge once the client is in the chair):
- First hair system installation (system + install): $800 to $1,000
- Retouch appointment: $95
- Once they have 3+ clients, start promoting a $300/month unlimited retouch membership (most clients only come in 1x/week max, usually every 2 weeks)
- Never ask "have you decided on your price?" — instead TELL them the recommended pricing above

## OTHER GUIDELINES
- NEVER use the label "Coach check-in:" or "Accountability Check:" — just ask your closing question naturally
- Always say "free hair system consultation" or "free hair loss consultation" — NEVER just "free consultation." The specificity matters for client trust and SEO.
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
        supabase.from("dynamic_todo_items").select("id, list_id, title, is_important").order("order_index"),
      ]);
      const lists = listsRes.data || [];
      const items = itemsRes.data || [];
      const completedIds = new Set(dynamicProgress.filter((p: any) => p.completed).map((p: any) => p.item_id));

      // Calculate overall completion
      const totalItems = items.length;
      const totalCompleted = items.filter((i: any) => completedIds.has(i.id)).length;
      const overallPct = totalItems ? Math.round((totalCompleted / totalItems) * 100) : 0;

      context += `\nACEDEMY PROGRESS (quizzes/modules only — shown above).\n`;
      context += `\nCHECKLIST PROGRESS (business tasks): ${totalCompleted}/${totalItems} tasks done (${overallPct}%)\n`;
      context += `⚠️ IMPORTANT: Do NOT say the user "finished all training", "completed everything", "knocked out all their tasks", or similar unless CHECKLIST PROGRESS is 100%. Passing quizzes only means coursework is done — NOT that all business/marketing tasks are done. Be precise about what they completed.\n\n`;

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

      // Recently completed tasks (last 7 days) — so Aion can congratulate progress
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentlyCompleted = dynamicProgress.filter(
        (p: any) => p.completed && p.completed_at && new Date(p.completed_at) >= sevenDaysAgo
      );
      if (recentlyCompleted.length > 0) {
        const itemMap = new Map(items.map((i: any) => [i.id, i]));
        context += `\nRecently completed tasks (last 7 days):\n`;
        for (const p of recentlyCompleted) {
          const item = itemMap.get(p.item_id);
          if (!item) continue;
          const completedDate = new Date(p.completed_at);
          const daysAgo = Math.floor((Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
          const timeLabel = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
          context += `  ✅ "${item.title}"${item.is_important ? " ⚡" : ""} — completed ${timeLabel}\n`;
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

async function buildConversationMemory(userId: string, currentConversationId?: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  try {
    // Find the most recent conversation that is NOT the current one
    let query = supabase
      .from("aion_conversations")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(2);

    const { data: convs } = await query;
    if (!convs || convs.length === 0) return "";

    // Pick the first conversation that isn't the current one
    const prevConv = convs.find((c: any) => c.id !== currentConversationId) || null;
    if (!prevConv) return "";

    // Fetch last 8 messages from that conversation
    const { data: msgs } = await supabase
      .from("aion_messages")
      .select("role, content")
      .eq("conversation_id", prevConv.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!msgs || msgs.length === 0) return "";

    // Reverse to chronological order
    msgs.reverse();

    let context = "\n\n--- PREVIOUS CONVERSATION CONTEXT ---\n";
    context += "(Last conversation with this member — use to avoid repeating congratulations or advice you already gave)\n\n";
    for (const m of msgs) {
      const label = m.role === "user" ? "Member" : "Aion";
      // Truncate long messages to save tokens
      const content = m.content.length > 300 ? m.content.slice(0, 300) + "..." : m.content;
      context += `${label}: ${content}\n\n`;
    }
    return context;
  } catch (e) {
    console.error("Failed to fetch conversation memory:", e);
    return "";
  }
}

// Detect bare greetings — these should NOT go through the full coaching pipeline
const GREETING_PATTERNS = /^\s*(hey|hi|hello|yo|sup|what'?s\s*up|hiya|howdy|good\s*(morning|afternoon|evening))\s*[!?.]*\s*$/i;

function isBareGreeting(messages: any[]): boolean {
  if (!messages || messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== "user") return false;
  return GREETING_PATTERNS.test(lastMsg.content.trim());
}

function buildGreetingSSE(text: string): string {
  // Format as SSE matching the OpenAI streaming format the frontend expects
  const chunk = JSON.stringify({
    choices: [{ delta: { content: text } }],
  });
  return `data: ${chunk}\n\ndata: [DONE]\n\n`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- BARE GREETING SHORT-CIRCUIT ---
    // If the user just said "hey" / "hi" / "hello" etc. with no actual question,
    // return a short fixed greeting immediately. No curriculum, no progress dump,
    // no coaching plan. This prevents the "hard-coded feeling" repeated dump.
    if (isBareGreeting(messages)) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(buildGreetingSSE("Hey! 👋 What's on your mind today?"), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Resolve user identity for personalization
      let userId: string | null = null;
      let firstName = "";
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
        try {
          const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) userId = user.id;
        } catch { /* proceed without user */ }
      }

      // Fetch lightweight context: name, recent wins (48h), a few incomplete tasks, and conversation memory
      let greetingContext = "";
      if (userId) {
        const admin = getSupabaseAdmin();
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const [profileRes, recentProgressRes, itemsRes, listsRes, memoryCtx] = await Promise.all([
          admin.from("profiles").select("full_name").eq("id", userId).single(),
          admin.from("user_dynamic_todo_progress")
            .select("item_id, completed_at")
            .eq("user_id", userId)
            .eq("completed", true)
            .gte("completed_at", fortyEightHoursAgo),
          admin.from("dynamic_todo_items").select("id, list_id, title, is_important").order("order_index"),
          admin.from("dynamic_todo_lists").select("id, title, order_index").order("order_index"),
          buildConversationMemory(userId, conversationId),
        ]);

        if (profileRes.data?.full_name) {
          firstName = profileRes.data.full_name.split(" ")[0];
        }

        const items = itemsRes.data || [];
        const itemMap = new Map(items.map((i: any) => [i.id, i]));

        // Recent wins (last 48h)
        const recentWins = (recentProgressRes.data || [])
          .map((p: any) => itemMap.get(p.item_id)?.title)
          .filter(Boolean);

        // Find incomplete tasks — get ALL progress to know what's done
        const { data: allProgress } = await admin
          .from("user_dynamic_todo_progress")
          .select("item_id")
          .eq("user_id", userId)
          .eq("completed", true);
        const completedIds = new Set((allProgress || []).map((p: any) => p.item_id));
        const incompleteTasks = items
          .filter((i: any) => !completedIds.has(i.id))
          .slice(0, 3)
          .map((i: any) => i.title);

        greetingContext += `\nMember name: ${firstName || "there"}\n`;
        if (recentWins.length > 0) {
          greetingContext += `\nTasks completed in last 48 hours:\n`;
          for (const w of recentWins.slice(0, 3)) {
            greetingContext += `  ✅ "${w}"\n`;
          }
        } else {
          greetingContext += `\nNo tasks completed in the last 48 hours.\n`;
        }
        if (incompleteTasks.length > 0) {
          greetingContext += `\nNext incomplete tasks:\n`;
          for (const t of incompleteTasks) {
            greetingContext += `  ⬜ "${t}"\n`;
          }
        }
        if (memoryCtx) {
          greetingContext += memoryCtx;
        }
      }

      const greetingSystemPrompt = `You are Aion, a casual coaching assistant for barbers. The user just said a greeting.

HARD RULES — VIOLATING ANY = BAD RESPONSE:
- 1-2 sentences ONLY. Never more. Never bullet lists. Never numbered lists. Never headings.
- NEVER list your capabilities or what you can help with. Don't say "I can help with X, Y, Z."
- NEVER say things like "step-by-step game plan", "coach in your pocket", "here's what I can help you with".
- NEVER explain who you are beyond "I'm Aion".
- Just greet${firstName ? ` ${firstName}` : ""} and ask a SHORT question like "What's up?" or "What's on your mind?".
- You MAY (optional) mention ONE recent win OR suggest ONE next task — but only if it fits in the 1-2 sentence limit and wasn't already mentioned in PREVIOUS CONVERSATION CONTEXT.

GOOD examples:
"Hey ${firstName || "there"} 👋 What's on your mind?"
"Yo ${firstName || ""}. Saw you knocked out the consultation script — nice. What's next?"

BAD (NEVER do this):
"Here's what I can help with: • this • that • the other"
${greetingContext}`;

      const greetingResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: greetingSystemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!greetingResponse.ok) {
        // Fallback to static greeting on AI failure
        const name = firstName ? ` ${firstName}` : "";
        return new Response(buildGreetingSSE(`Hey${name}! 👋 What's on your mind today?`), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      return new Response(greetingResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // --- FULL AI PIPELINE (only for real questions / requests) ---
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

    // Build system prompt with curriculum + user-specific data + conversation memory in parallel
    const [curriculumContext, userContext, memoryContext] = await Promise.all([
      buildCurriculumContext(),
      userId ? buildUserContext(userId) : Promise.resolve(""),
      userId ? buildConversationMemory(userId, conversationId) : Promise.resolve(""),
    ]);
    const systemPrompt = BASE_SYSTEM_PROMPT + curriculumContext + userContext + memoryContext;

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
