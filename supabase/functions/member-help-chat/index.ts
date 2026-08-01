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
- When the member is asking how to move a potential client toward booking, coach them to invite that person to a free hair system consultation. Do not bring this up in unrelated support, technical, course, or account questions.
- For lead-facing pricing questions, do not coach them to quote a price before the consultation. The goal is to get the potential client into a free hair system consultation first.

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

Talk like a knowledgeable person who understands the question, not a template that is trying to look helpful. Choose one format deliberately:

1. Direct factual or technical question: answer it in 1-4 natural sentences. No heading, bullets, recap, unrelated coaching, or closing question.
2. "How do I…?" question: lead with the answer, then use 3-5 short numbered steps only when the order matters. Give exact words to say or type only when the member needs words to use.
3. "What should I do next?" or progress question: use the member's actual progress and recommend the single best next move. Offer a second option only if there is a real tradeoff.
4. Complex strategy or comparison: give the conclusion first, then use up to three short labeled sections or five bullets if that makes the decision clearer.

Do not turn a small question into a lesson. Do not restate the member's question, repeat their request back to them, announce what you are about to explain, add a generic summary, or ask a follow-up when the answer is already complete.

Only bring up checklists or progress when the member explicitly asks about progress, next steps, getting clients, or accountability. Never bolt a checklist task, congratulations, sales advice, or free-consultation pitch onto an unrelated answer.

For a casual greeting with no question, reply warmly in one or two sentences and ask what they need. Do not launch into coaching or a progress review.

For any action plan, be concrete and keep it short. Use bold only to make a genuine action list easier to scan; do not use markdown headings as decoration. End naturally when the answer is complete.

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

## REFUNDS & THE 3 CLIENT GUARANTEE
If a member sounds frustrated, asks about quitting, asks "how do I get a refund", asks if they can get their money back, or seems to be looking for the exit — DO NOT be defensive or dismissive. Acknowledge them as a real person first.

How to handle it:
1. Acknowledge what they're feeling. Don't gaslight them with "just keep grinding."
2. Ask what specifically isn't working — is it leads, the kit, the training, time, motivation?
3. Try to actually help with the root issue first (point them to the specific checklist task, group call, or Contact a Person tab).
4. THEN, if they're still asking about refunds, explain the 3 Client Guarantee honestly:

**The 3 Client Guarantee (the only refund path):**
- Refunds are ONLY available through the 3 Client Guarantee. Otherwise all sales are final.
- If a student completes the required steps and still does not get 3 paying hair system clients within 16 weeks, they're eligible for their money back.
- To qualify they must: complete all required training modules and quizzes, submit certification photos and pass certification, run the required ad spend for at least 50 days, respond to Barber Launch when support/setup/campaign updates are needed, and stay active in the program during the 16-week period.
- If they qualify and still didn't hit 3 clients, Barber Launch honors the guarantee, and they keep their website, certification, training access, CRM setup, and business assets.

If someone is asking about refunds and clearly hasn't done the required steps yet, gently and honestly tell them they're not currently eligible — and then redirect: "The good news is the path to getting your money back is the same path to getting clients. Let's just do the work." Then give them ONE next checklist task to do today.

If you ever feel like someone is acting sketchy (asking about refunds without doing any of the work, trying to extract loopholes, fishing for technicalities to get out), do not get into a legal argument with them. Stay calm, point them to the actual guarantee terms above, and tell them to use the "Contact a Person" tab to reach the admin team directly. Do not improvise refund offers, promises, timelines, or exceptions — only the admin team can do that.

## OTHER GUIDELINES
- NEVER use the label "Coach check-in:" or "Accountability Check:" — just ask your closing question naturally
- Always say "free hair system consultation" or "free hair loss consultation" — NEVER just "free consultation." The specificity matters for client trust and SEO.
- If you don't know something specific about the user's account, suggest they use the "Contact a Person" tab to reach the admin team
- Use simple language — many users are new to hair systems
- Never make up specific platform features that don't exist
- Never invent a platform destination, community space, call schedule, delivery status, or support process. Only name one when it is present in the information you were given.
- When teaching concepts, use the curriculum knowledge below as your source of truth
- The CORRECT answers represent the factual knowledge you should teach
- The INCORRECT answers represent common misconceptions — gently correct users who express these misconceptions`;

type AionKnowledgeEntry = {
  id: string;
  keywords: string[];
  content: string;
};

type AionChatMessage = {
  role?: unknown;
  content?: unknown;
};

// Operational facts live here instead of in the coaching instructions. Entries are
// retrieved only when the member's question is relevant, so they inform a natural
// answer without turning into a canned response or an unrelated repeat.
const AION_KNOWLEDGE_BANK: AionKnowledgeEntry[] = [
  {
    id: "live-client-course-memory-index",
    keywords: [
      "live client", "part 1", "part 2", "part 3", "part 4", "lesson", "lessons",
      "video", "videos", "course", "training", "quiz", "quizzes", "client service",
      "client appointment", "cut in", "cut-in", "maintenance appointment",
    ],
    content: `Live Client course memory index:
- Part 1: scalp and unit preparation, alcohol cleaning, skin versus lace cleaning, dry fit, natural hairline/reference marks, and adhesive placement.
- Part 2: adhesive application/dry time, controlling the system with pins, rolling it into position without wrinkles, securing the bond, and protecting the front edge.
- Part 3: conservative cut-in, gradual length removal, blending system and natural hair, 45-degree texturizing, and avoiding blunt or over-thinned bangs.
- Part 4: softening the front hairline, final side/back balance, maintenance expectations, and honest client expectation-setting.
- How and What to Charge: appointment timing, quality-versus-cheap hair, and the reasoning behind consultation and pricing guidance.

These transcripts supplement the full Barber Launch curriculum, all published lessons, and the live quiz knowledge already in your context. They are not the only source of installation guidance, and you must never imply that an installation answer is limited to these four videos. Use them only when they meaningfully help answer the member's actual question — whether that is about a video, a quiz, a client conversation, pricing, or a technical technique.`,
  },
  {
    id: "kit-delivery-timelines",
    keywords: [
      "kit",
      "shipping",
      "ship",
      "delivery",
      "deliver",
      "tracking",
      "track",
      "package",
      "where is my stuff",
      "where's my stuff",
      "where is my order",
      "where's my order",
      "missing",
    ],
    content: `Full Barber Launch kits usually arrive in 7-9 days, though they can occasionally take a little longer. This is a full kit, not a standard hair system order. Standard hair system orders usually arrive within 5 business days.

Use these facts only when they help answer the member's specific question. Do not copy this wording or turn it into a fixed script. If a member says their full kit has been delayed beyond 9 days, offer the real next step naturally: [Schedule a 1-on-1 call with our team](/schedule-call). Do not claim to see an individual order, shipment, or tracking status unless that information is actually available.`,
  },
  {
    id: "live-client-part-1-prep-and-placement",
    keywords: [
      "prepare the scalp", "scalp prep", "99% alcohol", "alcohol", "clean the scalp",
      "skin system", "lace system", "dry fit", "template", "hairline", "reference line",
      "adhesive placement", "where do i put adhesive", "place the system",
    ],
    content: `Live Client Part 1 transcript knowledge — preparation and dry placement:
- Prepare the top rather than framing it to the client as “shaving”; use the template or a careful dry fit to establish the wear area.
- For scalp prep, 99% alcohol is used to break down oil and sweat. Let it work briefly before wiping; wiping with a towel immediately absorbs it too soon. Clean thoroughly, then let the scalp become dry before bonding.
- Clean a skin system’s underside with alcohol. For lace, shampoo and clarify it because moisture, oil, or product can wick through the lace/knots.
- Dry-fit before permanent placement. Use forehead/face proportions, existing wear/tan cues, and alignment marks to establish a natural reference line and center the unit; check it before making permanent cuts.
- Put scalp adhesive about a pencil’s distance above the drawn front reference line, not directly on that reference line. Keep the system aligned to the marks and trim the unit to fit only after the placement plan is clear.
Use this as technical guidance, not a verbatim script. If the member has a different base, adhesive, allergy, or scalp condition, ask the needed follow-up rather than pretending one technique fits every case.`,
  },
  {
    id: "live-client-part-2-bonding-and-front-edge",
    keywords: [
      "bond", "bonding", "pins", "pin", "adhesive coat", "adhesive dry", "tacky",
      "front edge", "wrinkle", "install", "installation", "attach", "secure the system",
      "hair in adhesive", "system placement",
    ],
    content: `Live Client Part 2 transcript knowledge — bonding and protecting the front edge:
- Pins can keep a skin system controlled and off the floor while the adhesive work is done, reducing contamination and helping keep hair out of the adhesive.
- Work adhesive carefully across the intended surface. Brush/stroke it into contact rather than leaving a heavy, uneven puddle; remove loose hairs from the tool before they contaminate the bond.
- Wait for the adhesive to dry clear/tacky according to its actual behavior and manufacturer directions — not a made-up fixed number of minutes.
- When rolling the system into position, use the placement marks, keep control of the direction, and make small adjustments before committing the front. Avoid pulling in a way that creates wrinkles.
- Once placed, press the system firmly so the system adhesive/tape and scalp adhesive bond together. Handle the front edge gently at first; do not aggressively comb, cut too close to it, or prematurely release it before the bond is secure.`,
  },
  {
    id: "live-client-part-3-cutting-and-blending",
    keywords: [
      "cut in", "cutting", "blend", "blending", "texturizing shears", "thinning shears",
      "45 degree", "angle", "bangs", "fade", "bulk", "cut the system", "too short",
    ],
    content: `Live Client Part 3 transcript knowledge — cutting and blending:
- Start conservatively. Leave the system slightly longer than the desired finished look, because it is easy to remove more but impossible to put length back.
- Build the initial shape through controlled center and pie-shaped sections rather than one hard straight cut. Preserve enough length and versatility for the client’s style.
- Blend the system hair with the client’s natural hair using thin sections and texturizing shears around a 45-degree angle. Avoid blunt straight-across lines, which create obvious shelves and an artificial finish.
- Use texturizing to remove bulk gradually and create different lengths. Be especially cautious around the bangs/front: cutting or thinning them too short is a common irreversible mistake.
- A fade or short natural hair can expose more scalp, so adapt the blend and density to the client’s hair, head shape, and finished style instead of forcing a preset fade.`,
  },
  {
    id: "live-client-part-4-finishing-and-expectations",
    keywords: [
      "finish", "finishing", "finish the cut", "front hairline", "baby hairs", "maintenance",
      "three to six weeks", "expectations", "haircut", "thinning shears", "around the ears",
      "square the back", "fade", "final look",
    ],
    content: `Live Client Part 4 transcript knowledge — finishing, maintenance, and expectations:
- Soften a front hairline gradually with texturizing/thinning work to break up a straight edge and create natural-looking baby hairs; do not over-thin or make an aggressive cut at the bonded front.
- Finish around the ears, sideburns, and back by following the client’s facial/head shape and checking the visual balance from both sides. Use thinning shears as a slower, safer way to soften and blend without leaving hard lines.
- Keep enough density where the hair looks thin; do not chase a lower or sharper outline if it will make the result look sparse.
- Set expectations honestly. A client who wants an aggressive fade may need a more conservative first cut-in; explain the choice, then refine at a return visit. The lesson discusses return timing in the roughly three-to-six-week range, but members should follow the actual system, adhesive, scalp, and service plan rather than promise one universal schedule.`,
  },
  {
    id: "how-and-what-to-charge-transcript",
    keywords: [
      "how much", "what should i charge", "pricing", "price", "schedule", "appointment time",
      "cut in time", "maintenance time", "retouch", "cost of hair", "consultation price",
    ],
    content: `How and What to Charge transcript knowledge:
- The lesson frames the first client as slower while the barber learns the workflow, with speed improving after the first few clients.
- Its working example schedules about two hours for a new-system cut-in and about one hour for a maintenance removal/reapplication appointment.
- It warns against choosing hair only because it is inexpensive: low-quality hair can tangle, fade, shed from the base, have an unsuitable base thickness, or carry unsuitable density.
This is training guidance, not a guarantee of appointment duration or a universal price. Give members the platform’s current pricing guidance when they ask what to charge, and use these transcript details to explain the reason behind it.`,
  },
];

function buildRelevantKnowledgeContext(messages: AionChatMessage[]): string {
  const recentMemberText = messages
    .filter((message) => message?.role === "user" && typeof message.content === "string")
    .slice(-4)
    .map((message) => (message.content as string).toLowerCase())
    .join("\n");

  if (!recentMemberText) return "";

  const relevantEntries = AION_KNOWLEDGE_BANK.filter((entry) =>
    entry.keywords.some((keyword) => recentMemberText.includes(keyword)),
  );

  if (relevantEntries.length === 0) return "";

  return `\n\n--- RELEVANT KNOWLEDGE BANK ---\nUse only the entries that are relevant to the member's request. These are facts to draw from, not scripts to repeat. Match the response to the member's actual question.\n\n${relevantEntries.map((entry) => `## ${entry.id}\n${entry.content}`).join("\n\n")}`;
}

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function buildCurriculumContext(): Promise<string> {
  const supabase = getSupabaseAdmin();

  try {
    const [coursesRes, modulesRes, lessonsRes, questionsRes, todoListsRes, todoItemsRes] = await Promise.all([
      supabase.from("courses").select("id, title, description, category").eq("is_published", true).order("order_index"),
      supabase.from("modules").select("id, course_id, title, description").eq("is_published", true).order("order_index"),
      supabase.from("lessons").select("id, module_id, title, description").order("order_index"),
      supabase.from("quiz_questions").select("id, module_id, lesson_id, question_text, question_type").order("order_index"),
      supabase.from("dynamic_todo_lists").select("id, title, order_index, due_days").order("order_index"),
      supabase.from("dynamic_todo_items").select("id, list_id, title, section_title, is_important, order_index").order("order_index"),
    ]);

    const courses = coursesRes.data || [];
    const modules = modulesRes.data || [];
    const lessons = lessonsRes.data || [];
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

          // Newer quizzes are attached to an individual lesson instead of the
          // module. Keep them in the same live curriculum context so Aion can
          // answer questions about recently added lessons as accurately as it
          // can the original module quizzes.
          const moduleLessons = lessons.filter((lesson: any) => lesson.module_id === mod.id);
          for (const lesson of moduleLessons) {
            const lessonQuestions = questions.filter((q: any) => q.lesson_id === lesson.id);
            if (lessonQuestions.length === 0) continue;

            context += `\n#### Lesson quiz: ${lesson.title}\n`;
            if (lesson.description) context += `${lesson.description}\n`;
            for (const q of lessonQuestions) {
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
    // Fetch every current checklist source and the member's quiz attempts in parallel.
    // Dynamic lists include the Installation Checklist; `todos` is the older checklist
    // system that is still present for some members.
    const [profileRes, quizAttemptsRes, todoProgressRes, dynamicProgressRes, legacyTodosRes, listsRes, itemsRes] = await Promise.all([
      supabase.from("profiles").select("full_name, created_at").eq("id", userId).single(),
      supabase.from("user_quiz_attempts").select("id, module_id, lesson_id, score, total_questions, completed_at").eq("user_id", userId).order("completed_at", { ascending: false }),
      supabase.from("user_todos").select("todo_id, completed, completed_at").eq("user_id", userId),
      supabase.from("user_dynamic_todo_progress").select("item_id, completed, completed_at").eq("user_id", userId),
      supabase.from("todos").select("id, title, description, type, week_number, order_index").order("week_number").order("order_index"),
      supabase.from("dynamic_todo_lists").select("id, title, order_index").order("order_index"),
      supabase.from("dynamic_todo_items").select("id, list_id, title, is_important").order("order_index"),
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

    // Quiz progress — both legacy module quizzes and newer lesson quizzes.
    const quizAttempts = quizAttemptsRes.data || [];
    const quizTargetTitles = new Map<string, string>();
    if (quizAttempts.length > 0) {
      const moduleIds = [...new Set(quizAttempts.map((a: any) => a.module_id).filter(Boolean))];
      const lessonIds = [...new Set(quizAttempts.map((a: any) => a.lesson_id).filter(Boolean))];
      const [modulesResult, lessonsResult] = await Promise.all([
        moduleIds.length > 0
          ? supabase.from("modules").select("id, title").in("id", moduleIds)
          : Promise.resolve({ data: [] }),
        lessonIds.length > 0
          ? supabase.from("lessons").select("id, title, module_id").in("id", lessonIds)
          : Promise.resolve({ data: [] }),
      ]);
      const modulesData = modulesResult.data;
      const lessonsData = lessonsResult.data;
      const moduleMap = new Map((modulesData || []).map((m: any) => [m.id, m.title]));
      const lessonMap = new Map((lessonsData || []).map((lesson: any) => [lesson.id, lesson.title]));
      for (const [id, title] of moduleMap) quizTargetTitles.set(`module:${id}`, title);
      for (const [id, title] of lessonMap) quizTargetTitles.set(`lesson:${id}`, title);

      context += `\nQuiz results:\n`;
      // Show best attempt per specific lesson or module, rather than combining
      // several new lesson quizzes under one old module record.
      const bestByQuizTarget = new Map<string, any>();
      for (const attempt of quizAttempts) {
        const targetKey = attempt.lesson_id ? `lesson:${attempt.lesson_id}` : `module:${attempt.module_id}`;
        const existing = bestByQuizTarget.get(targetKey);
        if (!existing || attempt.score > existing.score) {
          bestByQuizTarget.set(targetKey, attempt);
        }
      }
      for (const attempt of bestByQuizTarget.values()) {
        const title = attempt.lesson_id
          ? lessonMap.get(attempt.lesson_id) || "Unknown lesson"
          : moduleMap.get(attempt.module_id) || "Unknown module";
        const passed = attempt.score >= Math.ceil(attempt.total_questions * 0.8);
        context += `  - ${title}: ${attempt.score}/${attempt.total_questions} ${passed ? "✅ PASSED" : "❌ NOT YET PASSED"}\n`;
      }
    } else {
      context += `\nQuiz results: No quizzes taken yet.\n`;
    }

    // The most recent attempt tells Aion which concept may need help. A single
    // miss is not evidence that someone "doesn't understand" it, so this is
    // strictly a private support signal for quiz- or topic-related questions.
    const latestByQuizTarget = new Map<string, any>();
    for (const attempt of quizAttempts) {
      const targetKey = attempt.lesson_id ? `lesson:${attempt.lesson_id}` : `module:${attempt.module_id}`;
      if (!latestByQuizTarget.has(targetKey)) latestByQuizTarget.set(targetKey, attempt);
    }
    const latestAttemptIds = [...latestByQuizTarget.values()].map((attempt: any) => attempt.id);
    if (latestAttemptIds.length > 0) {
      const { data: responseData } = await supabase
        .from("user_quiz_responses")
        .select("attempt_id, question_id, is_correct")
        .in("attempt_id", latestAttemptIds)
        .eq("is_correct", false);
      const missedResponses = responseData || [];
      const missedQuestionIds = [...new Set(missedResponses.map((response: any) => response.question_id))];
      if (missedQuestionIds.length > 0) {
        const { data: missedQuestionsData } = await supabase
          .from("quiz_questions")
          .select("id, question_text")
          .in("id", missedQuestionIds);
        const missedQuestionMap = new Map((missedQuestionsData || []).map((question: any) => [question.id, question.question_text]));
        const attemptById = new Map([...latestByQuizTarget.values()].map((attempt: any) => [attempt.id, attempt]));

        context += `\nQUIZ SUPPORT SIGNALS (use only if they ask for quiz/topic help; never volunteer this or call them confused):\n`;
        for (const response of missedResponses) {
          const attempt = attemptById.get(response.attempt_id);
          const targetKey = attempt?.lesson_id ? `lesson:${attempt.lesson_id}` : `module:${attempt?.module_id}`;
          const title = quizTargetTitles.get(targetKey) || "a recent quiz";
          const questionText = missedQuestionMap.get(response.question_id);
          if (questionText) context += `  - ${title}: ${questionText}\n`;
        }
      }
    }

    // Legacy checklist progress. This source was previously fetched but not
    // included in Aion's context at all.
    const legacyTodos = legacyTodosRes.data || [];
    if (legacyTodos.length > 0) {
      const completedLegacyTodoIds = new Set((todoProgressRes.data || [])
        .filter((progress: any) => progress.completed)
        .map((progress: any) => progress.todo_id));
      context += `\nLEGACY CHECKLIST PROGRESS:\n`;
      for (const todo of legacyTodos) {
        context += `  ${completedLegacyTodoIds.has(todo.id) ? "✅" : "⬜"} ${todo.title}\n`;
      }
    }

    // Dynamic checklist progress. This includes every named checklist in the
    // member portal, including the Installation Checklist, even for members
    // who have not checked off anything yet.
    const dynamicProgress = dynamicProgressRes.data || [];
    const lists = listsRes.data || [];
    const items = itemsRes.data || [];
    if (lists.length > 0) {
      const completedIds = new Set(dynamicProgress.filter((p: any) => p.completed).map((p: any) => p.item_id));

      // Calculate overall completion
      const totalItems = items.length;
      const totalCompleted = items.filter((i: any) => completedIds.has(i.id)).length;
      const overallPct = totalItems ? Math.round((totalCompleted / totalItems) * 100) : 0;

      context += `\nACADEMY PROGRESS (quizzes/modules only — shown above).\n`;
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
          // Checklist pages are short, concrete operational aids. Include all
          // outstanding items from them, especially Installation Checklist,
          // rather than hiding the later steps behind a generic summary.
          const itemsToShow = /checklist/i.test(list.title) ? incomplete : incomplete.slice(0, 5);
          for (const item of itemsToShow) {
            context += `    ⬜ ${item.title}\n`;
          }
          if (!/checklist/i.test(list.title) && incomplete.length > 5) {
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
      context += `\nDynamic checklist progress: No current checklist items found.\n`;
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
        return new Response(buildGreetingSSE("Hi there 👋 How can I help you today?"), {
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

      const greetingSystemPrompt = `You are Aion, a professional coaching assistant for barbers. The user just said a greeting.

HARD RULES — VIOLATING ANY = BAD RESPONSE:
- 1-2 sentences ONLY. Never more. Never bullet lists. Never numbered lists. Never headings.
- NEVER list your capabilities or what you can help with. Don't say "I can help with X, Y, Z."
- NEVER say things like "step-by-step game plan", "coach in your pocket", "here's what I can help you with".
- NEVER explain who you are beyond "I'm Aion".
- TONE: Professional, warm, polished — many members serve older clientele. NEVER use slang openers. BANNED words: "Yo", "Sup", "What's up" (as opener), "What's good", "Bro", "Fam", "Homie", "Dude", "My guy". Use "Hi", "Hello", or "Hey there" instead.
- Just greet${firstName ? ` ${firstName}` : ""} and ask a SHORT question like "How can I help?" or "What can I help you with today?".
- You MAY (optional) mention ONE recent win OR suggest ONE next task — but only if it fits in the 1-2 sentence limit and wasn't already mentioned in PREVIOUS CONVERSATION CONTEXT.

GOOD examples:
"Hi ${firstName || "there"} 👋 How can I help today?"
"Hello${firstName ? ` ${firstName}` : ""} — saw you knocked out the consultation script. Nice work. What's next?"

BAD (NEVER do this):
"Yo ${firstName || ""}, what's good?"
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
        return new Response(buildGreetingSSE(`Hi${name} 👋 How can I help you today?`), {
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

    // Build system prompt with curriculum + user-specific data + conversation memory in parallel.
    // Relevant operational facts are then retrieved from Aion's knowledge bank.
    const [curriculumContext, userContext, memoryContext] = await Promise.all([
      buildCurriculumContext(),
      userId ? buildUserContext(userId) : Promise.resolve(""),
      userId ? buildConversationMemory(userId, conversationId) : Promise.resolve(""),
    ]);
    const knowledgeContext = buildRelevantKnowledgeContext(messages);
    const systemPrompt = BASE_SYSTEM_PROMPT + curriculumContext + userContext + memoryContext + knowledgeContext;

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
