

# Fix Lessons Metric to Use Modules as the Unit

## Problem
The "Lessons" column shows "0/1" because it counts rows in the `lessons` table, but most course content lives directly in the `modules` table (modules have videos, quizzes, etc.). The `lessons` table has almost no rows.

## Solution
Switch the metric from counting `lessons` rows to counting **modules** as the unit of completion. A module counts as "completed" if:
- The user **passed the quiz** for that module (best score >= 80%) — sufficient on its own
- OR the user has a `user_progress` entry for a lesson in that module (video watch completion)

This means quiz passes automatically count as completed modules for all members (old and new).

## Changes

### `src/hooks/useAdminMembers.ts` — `useAdminMembers()`
1. Fetch all modules (`modules` table) instead of relying on `lessons` for the total count
2. Set `totalLessons` = total number of published modules (rename internally but keep the field name for UI compatibility)
3. For each member, a module is "completed" if:
   - They passed the quiz (>= 80%) for that module, OR
   - They have a `user_progress` entry for any lesson linked to that module
4. `lessonsCompleted` = count of completed modules

### `src/hooks/useAdminMembers.ts` — `useAdminMemberDetail()`
Same logic adjustment for the detail view: count completed modules using quiz pass + user_progress union.

### `src/pages/admin/Members.tsx`
Rename column header from "Lessons" to "Modules" for clarity.

### `src/components/dashboard/ProgressOverview.tsx`
Also count quiz-passed modules as completed in the user-facing progress overview, using the same logic (fetch quiz attempts, find passed modules, union with user_progress).

