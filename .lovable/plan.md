
## The issue

On the Level 1 Cert modal, "Complete all lessons" shows a green checkmark next to `16/17` — a lie. Same with "Training games". The code hardcodes those rows as `completed: true` because they aren't actually required, but visually it looks like they're done when they're not.

The quiz list below is also messy — flat scroll of every quiz with tiny icons, no clear way to see which ones still need passing or jump to them.

## Required for cert (locked in)

- **Pass all quizzes** (miss ≤ 1 per quiz)
- **Submit work photos** (≥ 1)

Lessons and training games are NOT required and will be removed from the requirements checklist entirely — no more fake checkmarks.

## Changes

### 1. `Level1CertModal.tsx` — requirements list

- Drop the "Complete all lessons" and "Training games" rows from the `requirements` array.
- Keep only the two real requirements:
  - Pass all quizzes (green check when done, amber warning with `X/Y passed` when not)
  - Submit work photos (green check when ≥1, empty circle when 0)
- Amber/incomplete rows get a subtle amber tint + left border so what's missing pops.
- Auto-expand the quiz details section whenever any quiz is unpassed.
- Remove the now-unused `useAllLessonsCompleted` and `useTrainingGamesCompleted` hooks.

### 2. `QuizProgressList.tsx` — redo the layout

Split into two clear groups:

```text
Quiz Progress                          2/4 passed
─────────────────────────────────────────────────
Still to pass (2)
  ⚠  Cutting-In Quiz          60%   [Retake]
  ⚠  Application Quiz    Not taken  [Take Quiz]

Passed (2)                                     ▾
  ✓  Intro Quiz               100%
  ✓  Color Match Quiz          93%
```

- Unpassed quizzes on top, always expanded, amber styling.
- Each unpassed row gets a "Take Quiz" / "Retake" button that navigates to that module and closes the cert modal.
- Passed group collapsible, collapsed by default when everything's passed.
- Bigger status chips (Passed / Failed / Not taken) with color coding, not tiny icons.
- Footer line: "Miss no more than 1 question per quiz."

### 3. Data plumbing

`QuizProgressList` needs a route target per module so "Take Quiz" can navigate. Extend the quiz-progress payload from `useCertificationEligibility` to include the module's course id + first lesson id (or use existing routes if already present). Read-only DB usage — no schema changes.

## Files touched

- `src/components/certification/Level1CertModal.tsx`
- `src/components/certification/QuizProgressList.tsx`
- `src/hooks/useCertification.ts` (only if module-route data isn't already returned)

## Out of scope

- No changes to pass rules, cert generation, DB, or the "Get Certified" button copy.
