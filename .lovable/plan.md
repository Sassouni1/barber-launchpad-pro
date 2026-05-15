# Per-Sub-Lesson Quizzes

Right now quizzes are attached to **modules** only. This change lets you attach an independent quiz to any **sub-lesson** as well.

## What you'll get

- Restore the **Has Quiz** toggle on the sub-lesson form in the Course Builder.
- When enabled, a **Manage Quiz** button appears on that sub-lesson (same editor as the module quiz, but scoped to the sub-lesson).
- On the member lesson page, each sub-lesson with a quiz gets its own **Take Quiz** section inline in the sub-lesson list, with score tracking separate from the module quiz.

## Technical changes

1. **Database**
   - Add `lesson_id uuid` (nullable) to `quiz_questions`.
   - Add `lesson_id uuid` (nullable) to `user_quiz_attempts`.
   - Make `module_id` nullable on both (a question/attempt belongs to *either* a module or a lesson).
   - Add a check constraint via trigger: exactly one of `module_id` / `lesson_id` must be set.

2. **Hooks (`src/hooks/useQuiz.ts`)**
   - `useQuizQuestions`, `useQuizAttempts`, `useSubmitQuiz` accept either `{ moduleId }` or `{ lessonId }`.
   - All CRUD mutations (create/update question) accept `lesson_id` alternative.

3. **Admin (`src/components/admin/QuizManager.tsx` + `CourseBuilder.tsx`)**
   - QuizManager takes `{ moduleId?, lessonId? }`.
   - Re-add the **Has Quiz** switch on the sub-lesson form.
   - Add a **Manage Quiz** button per sub-lesson row when `lesson.has_quiz` is true.

4. **Member UI (`src/pages/Lesson.tsx`)**
   - In the sub-lesson list, when `lesson.has_quiz` is true, render a collapsible quiz block (same UI as the existing module quiz, just scoped by `lessonId`).

5. **Edge function (`supabase/functions/verify-quiz/index.ts`)**
   - Accept `lessonId` as an alternative to `moduleId`; verify and record the attempt against whichever was passed.

## Out of scope

- Routing to a dedicated per-sub-lesson page. Quizzes will appear inline within the existing module lesson page.
- Migrating existing module quizzes to lesson quizzes (existing module quizzes keep working unchanged).

Confirm and I'll run the migration and ship the code.
