

# Change Auto-Completion Threshold to 100%

## Change
In `src/pages/Lesson.tsx` line 322, change `videoDuration * 0.7` to `videoDuration * 1.0` (or just `videoDuration`). The user must stay on the page for the full video duration (minimum 60 seconds) before the lesson is auto-marked complete.

### `src/pages/Lesson.tsx`
- Line 322: `Math.max(60, videoDuration * 0.7)` → `Math.max(60, videoDuration)`

One line change. No other files affected.

