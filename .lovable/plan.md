

# Improve All: Real Progress Tracking + Homework File Deletion Fix

## 4 improvements to implement:

### 1. ProgressOverview — Show real lesson completion percentages
**Current**: Progress bars hardcoded to `width: '0%'`
**Fix**: Query `user_progress` table to count completed lessons per course, calculate percentage, display real progress bars.

- In `src/components/dashboard/ProgressOverview.tsx`: import `useAuth` and `supabase`, fetch `user_progress` where `completed = true` for the current user, compute `completedCount / totalLessons` per course, and set the bar width accordingly.
- Update the "Keep Learning" stat to show actual completed lessons count.

### 2. Todos page — Show real stats instead of hardcoded 0
**Current**: "Course Tasks Done" and "Personal Goals Done" both show `0`
**Fix**: Query `user_todos` for the current user to count completed todos by type.

- In `src/pages/Todos.tsx`: import `useAuth`, use the existing `useTodosWithSubtasks` and user todo data to compute:
  - "Course Tasks Done" = count of completed course-type todos
  - "Personal Goals Done" = count of completed daily + weekly todos

### 3. Behind-schedule indicator for users
**Current**: `due_days` column exists on `dynamic_todo_lists` and admin sees "behind" status, but users never see it.
**Fix**: Surface a small warning badge on the dashboard `DynamicTodoList` when the user's account age exceeds `due_days` for the current list.

- In `src/hooks/useDynamicTodos.ts`: include `due_days` in the returned list data (already fetched).
- In `src/components/dashboard/DynamicTodoList.tsx`: compare `due_days` against user's `created_at` from profile. If overdue, show a subtle "You're behind schedule" warning with an `AlertTriangle` icon.

### 4. Fix homework_files RLS — Allow users to delete their own files
**Current**: No DELETE policy on `homework_files`, so the delete button silently fails.
**Fix**: Add a DELETE RLS policy matching the existing INSERT/SELECT pattern.

- Database migration:
```sql
CREATE POLICY "Users can delete own homework files"
ON public.homework_files FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM homework_submissions hs
    WHERE hs.id = homework_files.submission_id
    AND hs.user_id = auth.uid()
  )
);
```

### Files to edit
- `src/components/dashboard/ProgressOverview.tsx` — real progress bars
- `src/pages/Todos.tsx` — real stats
- `src/hooks/useDynamicTodos.ts` — expose `due_days`
- `src/components/dashboard/DynamicTodoList.tsx` — behind-schedule warning
- Database migration for `homework_files` DELETE policy

