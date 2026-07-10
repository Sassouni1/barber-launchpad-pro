## Plan

Fix the mobile course popup bug by making lesson-sheet state follow the current route instead of surviving across course tracks.

### Changes
1. Update `src/pages/Courses.tsx` so the URL-to-selected-module sync runs on mobile too, not just desktop.
2. When `courseType` changes, clear any stale selected module so a lesson from the previous track cannot remain open over the new track selector.
3. When the mobile lesson sheet closes, remove the stale `?module=` parameter from the URL, matching the desktop behavior.
4. Keep this scoped to course navigation state only — no visual redesign, no lesson-content changes, no backend changes.

### Verification
- On mobile, open a lesson from Hair System, then switch to Business/Courses.
- Confirm no old lesson sheet appears over Track 1 / Track 2.
- Confirm direct links with `?module=` still open the intended lesson.