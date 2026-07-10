## The bug

On every lesson quiz results screen (`src/pages/Lesson.tsx`, both mobile and desktop variants, lines ~1736 and ~2272), the "Quiz Completed" green card shows for **any** best attempt — even failing ones. That's why members like Sherry think they're done after a 13/15 and never retake.

## The fix

When the user's best attempt fails `isQuizPassed` (miss ≤ 1), swap the green card for an amber one:

```
Quiz Score: 87%
Please retake the quiz and miss no more than 1 question to qualify for certification.
[ Retake Quiz ]
```

Passing attempts still show the existing green "Quiz Passed" card (renamed from "Quiz Completed" so it's actually accurate).

## Files touched

- `src/pages/Lesson.tsx` — import `isQuizPassed` from `@/lib/quizPass`; branch both quiz-result cards (mobile ~L1736 and desktop ~L2272) on pass/fail.

## Out of scope

- No changes to the underlying pass rule.
- No changes to existing certs.
- No server-side enforcement (separate concern, ask separately if you want it).
