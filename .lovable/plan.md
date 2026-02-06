

# Fix Video Randomly Pausing

## What's Happening
Every time a user taps their phone screen, switches apps, or interacts with the Vimeo player controls, the app refetches data in the background. This causes the lesson page to re-render, which destroys and recreates the video iframe -- pausing or restarting the video.

## Risk Level: Very Low
These are the same settings already used in `useCertification.ts` in this project. They are standard, well-documented options. The only tradeoff is that data won't auto-refresh for 5 minutes while sitting on the same page, which is completely fine for lesson content.

## Changes

### 1. Update `src/hooks/useCourses.ts`
Add `staleTime: 5 * 60 * 1000` and `refetchOnWindowFocus: false` to the `useQuery` options in the `useCourses` hook.

### 2. Update `src/hooks/useModuleFiles.ts`
Add the same `staleTime` and `refetchOnWindowFocus: false` to the `useModuleFiles` query, since this also runs on the lesson page and can trigger re-renders.

### 3. Update `src/hooks/useQuiz.ts`
Add the same settings to `useQuizQuestions` and `useQuizAttempts` queries.

### 4. Update `src/pages/Lesson.tsx`
Wrap the `getVimeoEmbedUrl()` call in `useMemo` so the iframe `src` stays stable across renders, preventing React from remounting the iframe even if a render does occur.

## What Won't Change
- Desktop experience stays identical
- Mobile visuals stay identical
- Data still loads fresh when navigating between lessons
- Quizzes, files, and all other features work normally

