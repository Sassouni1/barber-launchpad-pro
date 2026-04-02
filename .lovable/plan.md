

## Plan: Fix Greeting Ending — Natural Transition Instead of Awkward "What's on your mind?"

**The problem**: When Aion mentions a win or suggests a task, ending with "What's on your mind?" feels disconnected — you just gave them something specific, then pivoted to a generic open question. It should flow naturally, like "Or is there anything else I can help with?"

### Change

**File: `supabase/functions/member-help-chat/index.ts` — line 533**

Update this one instruction in the greeting prompt:

**Before:**
```
- End with a casual question like "What's on your mind?" or "What do you want to tackle today?"
```

**After:**
```
- If you mentioned a win or suggested a task, end with a natural transition like "Anything else on your mind I can help with?" or "Let me know if you need anything."
- If you just said hi with no win/task, end with "What's on your mind?" or "What can I help with?"
```

That's it — one line change in the prompt. The AI already picks the right path, it just needs better guidance on how to land the ending based on which path it chose.

### Example outputs after fix
- **Win mentioned**: "Hey Marcus! Nice work knocking out that consultation flow. Anything else on your mind I can help with?"
- **Task suggested**: "Hey Marcus! 👋 If you get a chance, adding that Free Consultation to your booking app would be a solid next step. Let me know if you need help with that!"
- **Simple greeting**: "Hey Marcus! What's on your mind today?"

