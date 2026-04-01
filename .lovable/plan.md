

## Plan: Smart Greeting Handler — Occasionally Mention Wins & Recommendations

**What changes**: Replace the current static greeting short-circuit with a lightweight AI call that uses a stripped-down prompt. Greetings still skip the heavy curriculum/coaching pipeline, but instead of always returning "Hey! What's on your mind?", Aion gets just enough context to occasionally mention a fresh win or suggest one thing to do — without the giant dump.

### How it works

**File: `supabase/functions/member-help-chat/index.ts`**

1. **Keep `isBareGreeting()` detection** — no change there.

2. **Replace the static response (lines 437-462) with a lightweight AI call**:
   - Fetch only: user's first name, tasks completed in the last 48 hours, and 2-3 incomplete tasks from their current stage
   - Fetch conversation memory (already have `buildConversationMemory`)
   - Build a short **greeting-only prompt** (~200 words, not the full `BASE_SYSTEM_PROMPT`):
     ```
     You are Aion, a casual coaching assistant. The user just said a greeting.
     
     Rules:
     - 2-3 sentences MAX. Never more.
     - Greet them by name.
     - You MAY (not must) do ONE of these — pick randomly, or skip all:
       a) Mention ONE recent win they completed (only if < 48h old and not in PREVIOUS CONVERSATION)
       b) Suggest ONE quick thing they could do from their incomplete tasks
       c) Just say hi and ask what's up
     - NEVER list multiple action items or give a coaching plan
     - NEVER summarize their overall progress ("you crushed training", "passed all quizzes")
     - Check PREVIOUS CONVERSATION — don't repeat anything already said there
     ```
   - Pass this mini-prompt + the conversation memory + the user's messages to the AI
   - Stream the response back normally (same SSE format)

3. **The full `BASE_SYSTEM_PROMPT` + curriculum + progress pipeline remains untouched** for real questions.

### Why this works
- The model can't dump the same coaching block because it never sees the full coaching prompt or the GOOD/BAD examples
- It has just enough data to be personal (name, 1-2 recent tasks, 1-2 incomplete tasks)
- The strict "2-3 sentences MAX" rule is much easier for the model to follow when the prompt itself is tiny
- Variety happens naturally because the model picks from wins/suggestions/plain greeting
- Real questions still get the full pipeline

### Example outputs for "hey"
- `"Hey Marcus! Saw you finished 'Print Hair System Poster' yesterday — solid move. What do you want to tackle today?"`
- `"Hey Marcus! 👋 What's on your mind?"`
- `"Hey Marcus! Have you had a chance to update your Instagram bio yet? That's a quick win. What's up?"`

