

# Module Completion: Two-Tier System (Legacy vs New Members)

## Summary

Members who joined **more than 14 days ago** ("legacy") get module completion based purely on quiz passes. Members who joined **within the last 14 days** ("new") require video watch completion (time-on-page via `user_progress`) OR a quiz pass OR manual "Mark Complete" — any of these counts.

The total shown (denominator) will only count modules that have quizzes (`has_quiz = true`), fixing the "32" issue.

## Changes

### `src/hooks/useAdminMembers.ts` — `useAdminMembers()`
1. **Fetch `has_quiz` field**: Change module select to `'id, course_id, has_quiz'`
2. **Filter total**: `totalLessons = allModules.filter(m => m.has_quiz).length`
3. **Per-member completion logic** uses `profile.created_at`:
   - If joined > 14 days ago (legacy): module complete = quiz passed (≥80%) for that module
   - If joined ≤ 14 days ago (new): module complete = quiz passed OR `user_progress` entry for a lesson in that module (video watch / manual complete)
   - Only count modules where `has_quiz = true`

### `src/hooks/useAdminMembers.ts` — `useAdminMemberDetail()`
Same two-tier logic applied to the detail view.

### `src/hooks/useAdminMembers.ts` — `useAdminStats()`
Already counts modules with `has_quiz` filter — just verify and align.

### `src/components/dashboard/ProgressOverview.tsx`
1. Fetch user's profile `created_at` to determine legacy vs new
2. Only count modules with `has_quiz = true` in the total
3. Apply same two-tier completion logic:
   - Legacy (>14 days): quiz pass only
   - New (≤14 days): quiz pass OR `user_progress` (video/manual complete)

### `src/pages/admin/Members.tsx`
No changes needed beyond the already-done "Modules" rename.

## Technical Detail

The 14-day cutoff uses `differenceInDays(new Date(), new Date(profile.created_at)) > 14`. The `user_progress` entries are created by: video auto-complete (time-on-page ≥ video duration), quiz submission (edge function auto-upserts), homework submission, or manual "Mark Complete" button — so for new members, any of these paths satisfies completion alongside the quiz requirement.

