

# Auto-Complete Video Lessons via Time on Page

## What it does
When a user opens a lesson with a Vimeo video, the app fetches the video's duration from the Vimeo oEmbed API (no SDK, no API key needed). It then tracks how long the user stays on the page. Once they've spent at least 70% of the video duration on the page (minimum 60 seconds), the lesson is automatically marked as complete — same as if they clicked "Mark Complete."

## Changes

### `src/pages/Lesson.tsx`
1. **Fetch video duration** — Add a `useEffect` that fires when `module.video_url` contains "vimeo". Calls `https://vimeo.com/api/oembed.json?url={video_url}` to get `duration` (seconds). Store in state.
2. **Time-on-page tracker** — Add a `useRef` for elapsed seconds and a `setInterval` (1-second tick) that increments the counter while the page is mounted.
3. **Auto-complete trigger** — Inside the interval callback, check: if `elapsedSeconds >= Math.max(60, videoDuration * 0.7)` and module is not already completed, call the existing `markModuleComplete()` function and clear the interval.
4. **Cleanup** — Clear interval on unmount or when module changes. Skip entirely if `isModuleCompleted` is already true on mount.
5. **No UI changes** — This is invisible to the user. The existing "Mark Complete" / "Completed" button still works as a manual override. A toast will appear when auto-completed.

### No other files need changes
- The `markModuleComplete` function and completion query already exist from the previous implementation
- No database changes needed
- No edge function changes needed

### Key details
- oEmbed API is free, no auth needed, works for public and unlisted Vimeo videos
- If oEmbed fails (private video, non-Vimeo URL), falls back to manual "Mark Complete" button only
- The 70% threshold with 60-second minimum prevents accidental completions from brief page visits

