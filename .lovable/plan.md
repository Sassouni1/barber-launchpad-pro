

## Plan: Add Cross-Conversation Memory for Aion

**The problem**: Right now, every new conversation starts from zero. Aion sees the user's progress data but has no idea what it said last time — so it repeats the same congratulations and advice every chat.

**The fix**: Fetch the tail of the user's previous conversation from the database and inject it into the system prompt as memory context. This way Aion knows what it already discussed and won't repeat itself.

### Changes

**1. Edge function: `supabase/functions/member-help-chat/index.ts`**

- Accept optional `conversationId` from the request body (alongside `messages`)
- Add a `buildConversationMemory(userId, currentConversationId)` function that:
  - Queries `aion_conversations` for the user's most recent conversation that is NOT the current one
  - Fetches the last ~8 messages from that conversation via `aion_messages`
  - Formats them as a `--- PREVIOUS CONVERSATION CONTEXT ---` block
- Inject this memory block into the system prompt after user progress
- Update the greeting rule (line 69-70) to reference this context:
  - "Check PREVIOUS CONVERSATION CONTEXT before congratulating. If you already acknowledged a task there, don't mention it again. If no previous context exists, you can mention recent completions once."
- Update the "When they return after completing tasks" rule (lines 48-52) to add: "Scan your previous messages in THIS conversation AND the PREVIOUS CONVERSATION CONTEXT. Only acknowledge completions you haven't already referenced."

**2. Frontend: `src/components/dashboard/AionChat.tsx`**

- Add `conversationId` to the fetch payload sent to the edge function so the backend can exclude the current conversation from the memory lookup

### What this gives you
- Aion remembers what it said last session — no repeated congratulations
- Aion can pick up where it left off ("Last time we talked about X...")
- No new database tables needed — uses existing `aion_messages` + `aion_conversations`
- Only fetches the last conversation (keeps token count reasonable)

### Technical details

```text
System prompt structure:
┌─────────────────────────────┐
│ BASE_SYSTEM_PROMPT          │ ← coaching rules, format, tone
├─────────────────────────────┤
│ PLATFORM CURRICULUM         │ ← courses, quizzes, checklist stages
├─────────────────────────────┤
│ THIS MEMBER'S PROGRESS      │ ← quiz scores, checklist %, recent completions
├─────────────────────────────┤
│ PREVIOUS CONVERSATION       │ ← last 8 messages from prior chat (NEW)
│ CONTEXT                     │
└─────────────────────────────┘
```

