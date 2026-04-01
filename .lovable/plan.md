

## Plan: Add Recently Completed Tasks to Aion's Context

**Problem**: Aion sees what's incomplete but doesn't know what was *recently* completed, so it can't congratulate users on new progress since their last chat.

**Approach**: In `buildUserContext()` inside `supabase/functions/member-help-chat/index.ts`, add a "recently completed" section that shows tasks completed in the last 7 days (with timestamps). Then add a system prompt instruction telling Aion to acknowledge recent completions.

### Changes

**File: `supabase/functions/member-help-chat/index.ts`**

1. **In `buildUserContext()`** (~line 269-305): After building the checklist progress, add a new block that filters `dynamicProgress` for items where `completed = true` and `completed_at` is within the last 7 days. Cross-reference with `items` to get task titles, and output them as:
   ```
   Recently completed tasks (last 7 days):
     ✅ "Post a story on Instagram" — completed 2 days ago
     ✅ "Update your bio" — completed today
   ```

2. **In `BASE_SYSTEM_PROMPT`** (~line 48-54, coaching rules section): Add a new rule:
   ```
   ### When they return after completing tasks
   - Check the "Recently completed tasks" section in their progress
   - If they've completed tasks since the conversation started, acknowledge it naturally — brief congrats, then move to the next thing
   - Don't over-celebrate. A quick "Nice, you knocked out [task name]" is enough. Then push forward.
   - If they completed something hard or important (⚡), give them a bigger shoutout
   ```

This way every time a user opens Aion, the system prompt includes what they recently finished, and Aion is instructed to acknowledge it naturally.

