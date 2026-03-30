

# Auto-Track Lesson Completion (No Vimeo SDK)

## Approach
Use three completion triggers that cover all lesson types without any video SDK integration:

1. **Quiz submission** — auto-marks the module's lessons complete when a quiz is submitted (in the edge function)
2. **Homework submission** — auto-marks complete when homework is submitted (client-side)
3. **Manual "Mark Complete" button** — for video-only modules with no quiz/homework, user clicks a button after watching

This covers every module type: quiz modules, homework modules, and plain video modules.

## Changes

### 1. `supabase/functions/verify-quiz/index.ts`
After recording the quiz attempt, query `lessons` for all lessons with matching `module_id`, then upsert into `user_progress` with `completed = true` for each. Uses the service role client so no RLS issues.

### 2. `src/pages/Lesson.tsx`
- Add a query to check if current module's lessons are already completed (`user_progress` where `completed = true`)
- After `handleHomeworkSubmit`, also upsert `user_progress` for the module's lessons
- Add a "Mark as Complete" / "Completed" button in the lesson header area, visible for all modules
- Button is green with checkmark if already completed, gold "Mark Complete" if not
- On click, upsert into `user_progress` for all lessons in this module

### 3. No database changes needed
The `user_progress` table already has INSERT and UPDATE RLS policies for authenticated users. The edge function uses the service role key.

### Files to edit
- `supabase/functions/verify-quiz/index.ts` — add lesson completion upsert after quiz attempt
- `src/pages/Lesson.tsx` — add completion query, "Mark Complete" button, auto-complete on homework submit

