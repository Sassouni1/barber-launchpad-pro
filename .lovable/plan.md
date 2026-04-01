
## Plan: Fix the Real Root Cause of Aion Repeating the Same Greeting Dump

You’re right: this does not look like a “memory” problem first. It looks like the request pipeline is effectively hard-wiring the same output whenever the user sends a bare greeting.

### What’s actually happening
In `supabase/functions/member-help-chat/index.ts`:

- Every request always builds and injects:
  - full curriculum context
  - full personal progress context
  - recent completions
  - previous conversation memory
- For a message like `"hey"`, the model still receives all of that heavy coaching/progress data.
- The prompt also contains a strong canned coaching pattern:
  - “what can I do today / how do I get clients” rules
  - a long “GOOD” example with exact actions
- So on low-information inputs like `"hey"`, the model falls back to the same high-salience coaching block.

That’s why it feels hard coded: not because the exact text is literally stored, but because the backend keeps sending the same ingredients and the same template path for greetings.

### Correct fix
Do not rely on more prompt wording to solve this.

Implement deterministic greeting handling in the edge function so simple greetings do **not** go through the full coaching pipeline.

### Changes to make

**1. In `supabase/functions/member-help-chat/index.ts`, detect pure greetings before building the big prompt**
- Inspect the last user message from `messages`
- If it is only something like:
  - `hi`
  - `hey`
  - `hello`
  - `yo`
  - `sup`
  - `what's up`
- return a short fixed response immediately

Example behavior:
- `"hey"` → `"Hey! Good to see you. What's on your mind today?"`
- No progress summary
- No congratulations
- No task list
- No “earning phase” dump

This is the key fix because it removes the hard-coded-feeling path entirely for bare greetings.

**2. Keep the normal AI path for real questions**
Messages like:
- “what should I do today”
- “should I make a flyer?”
- “how do I get clients?”
should still use the full personalized coaching pipeline.

So the routing becomes:

```text
Bare greeting
  -> deterministic short greeting response

Actual question / request
  -> build full context
  -> call AI
```

**3. Tighten the greeting boundary**
Use a strict matcher so this only catches true greetings, not mixed-intent messages.

Examples:
- Catch: `hey`
- Catch: `hello`
- Catch: `yo`
- Do not catch: `hey what should I do today`
- Do not catch: `hey should I make a flyer`
- Do not catch: `hello I need help pricing`

**4. Leave memory as a secondary improvement, not the primary fix**
Cross-conversation memory can still help with continuity later, but it does not solve the main issue you’re seeing now because the repeated dump is being triggered before memory matters.

### Why this is safer than prompt-only changes
Prompt-only fixes are fragile because:
- the same large progress block still gets injected every time
- the same coaching examples still dominate generation
- a lightweight greeting gives the model almost no user intent, so it defaults to the same strongest pattern

Deterministic greeting routing is safer because:
- it isolates bare greetings from the coaching engine
- it cannot accidentally “welcome them twice” with a giant dump
- it does not change how Aion answers real questions

### Files involved
- `supabase/functions/member-help-chat/index.ts`
  - add last-user-message parsing
  - add bare-greeting early return
  - only build full AI prompt when the message is not a bare greeting

### Verification
Test these cases after implementation:

1. Same conversation:
- user: `hey`
- expected: short greeting only

2. Repeated greetings:
- user: `hey`
- user: `hey`
- expected: short greeting only both times, no repeated coaching dump

3. Real question:
- user: `what should I do today`
- expected: personalized action plan

4. Mixed greeting + question:
- user: `hey what should I do today`
- expected: full AI response, not short-circuited

### Technical note
If desired, a second pass can later reduce prompt size for low-intent messages instead of full short-circuiting, but the simplest and most reliable first fix is the early return for pure greetings.
