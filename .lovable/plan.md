

## Plan: Improve Aion Response Formatting & Tone

### Problem
The AI ignores the existing formatting rules — using bold text instead of `###` headings, skipping numbered lists, writing long paragraphs, and producing a repetitive blog-style tone.

### Changes

**1. Rewrite formatting rules in the system prompt with concrete examples**
- File: `supabase/functions/member-help-chat/index.ts`
- Add a `## RESPONSE FORMAT (MANDATORY)` section with a before/after example showing exactly what good vs bad formatting looks like
- Include a short template the AI should follow for action-based responses
- Cap responses at ~150-200 words unless the user asks for detail
- Tell it to sound like a coach texting, not writing a blog post

**2. Separate the "accountability check-in" format**
- Instruct the AI to put the check-in question on its own line with a distinct prefix like `---` separator or `> ` blockquote so it visually separates from the advice

**3. Example template to embed in prompt**
```text
Good response format:

### 1. Update Your Instagram Bio ⚡
Add "Hair System Specialist" to your bio right now. If it's not there, leads don't know you offer it.

### 2. Tell Every Client Today
"Hey, I'm now doing hair systems." That's it. Say it to every chair today.

### 3. Start 20 Facebook Conversations
DM 20 people — friends, past clients, locals. Just let them know.

---
**Coach check-in:** Have you added a "Free Consultation" button to your booking app yet? That's your #1 task today.
```

**4. Tone instructions**
- "You're a coach sending a quick game plan, not writing an article"
- "Be direct. Short sentences. No filler motivation unless they ask for encouragement"
- "Max 3 action items per response unless asked for more"

### Files to Edit
- `supabase/functions/member-help-chat/index.ts` — system prompt only

