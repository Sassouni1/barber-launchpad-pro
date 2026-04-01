

## Plan: Strengthen Greeting Handling + Fix Scroll Jump

### Problem
The greeting rule (line 69-70) is too weak relative to the surrounding instructions. The `TASK-BASED COACHING` section says "USE IT. Every recommendation should come from their actual data" — that's a strong directive that overrides the softer greeting rule. The model sees incomplete tasks, recently completed tasks, and interprets "hey" as a chance to coach.

### Changes

**1. `supabase/functions/member-help-chat/index.ts` — Restructure prompt priority**

Move a **hard rule** to the very top of the prompt (right after line 10's intro paragraph, before TASK-BASED COACHING):

```
## CRITICAL: MATCH ENERGY TO THEIR MESSAGE
If the user's entire message is just a greeting (hey, hi, hello, what's up, yo, sup, how's it going), you MUST:
- Respond in 2-3 sentences MAX
- Do NOT list action items, tasks, or coaching plans
- Do NOT reference their checklist or quiz progress in detail
- Just say hey, optionally mention one recent win in passing, and ask what they need help with
- ONLY give structured coaching when they ASK a question or request help

This overrides ALL other instructions below. A greeting gets a greeting back — nothing more.
```

Also update the existing `TASK-BASED COACHING` header (line 24) to add a qualifier:
- Change "USE IT. Every recommendation should come from their actual data, not generic advice." 
- To: "USE IT — but ONLY when they ask for help or coaching. Every recommendation should come from their actual data, not generic advice."

Remove the duplicate greeting section at lines 69-70 since it's now covered by the top-level rule.

**2. `src/components/dashboard/AionChat.tsx` — Fix scroll jump on Enter**

The `useEffect` on line 132-134 calls `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })` which scrolls the **entire page**, not just the chat container. Fix by:
- Adding a ref to the ScrollArea's viewport element
- Replacing `scrollIntoView` with `viewportRef.current.scrollTop = viewportRef.current.scrollHeight` to scroll only within the chat area

