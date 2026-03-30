

# Show Full Quiz Status Per Module in Admin Member Detail

## Problem
The Quiz History section in the admin member detail only shows modules where the student **has submitted** a quiz. It doesn't show modules with quizzes that haven't been attempted yet — so seeing "2 quizzes" doesn't mean tracking is broken, it means Alec only took 2. But the admin has no way to see which quizzes are still outstanding.

## Solution
Enhance the Quiz History section to show **all modules that have quizzes**, with their attempt status:
- **Passed**: green badge with score
- **Failed**: red badge with score  
- **Not attempted**: grey "Not taken" badge

This gives admins a complete picture of quiz progress per student.

## Changes

### `src/hooks/useAdminMembers.ts` — `useAdminMemberDetail`
- Fetch all modules where `has_quiz = true`, ordered by course/order_index
- Cross-reference with the user's `user_quiz_attempts` to find best score per module
- Return a new `quizStatus` array with: `module_id`, `module_title`, `bestScore`, `totalQuestions`, `passed` (>=80%), `attempted`

### `src/pages/admin/Members.tsx` — Quiz History UI
- Replace the current flat list of attempts with a structured list showing every quiz-enabled module
- Each row shows: module title, best score badge (color-coded), and attempt count
- Keep the scroll area but show "X/Y passed" summary header
- Clicking a row could expand to show all attempts for that module (optional, keeps it concise)

### Files to edit
- `src/hooks/useAdminMembers.ts` — add modules query + quiz status aggregation
- `src/pages/admin/Members.tsx` — update Quiz History rendering

