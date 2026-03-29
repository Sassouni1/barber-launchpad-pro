

# Fix Marketing Checklist — Show One List at a Time (Like Dashboard)

## Problem
The Marketing Checklist page currently dumps ALL dynamic to-do items at once, broken into weird section categories by source list name. You want it to mirror the dashboard behavior: show one list at a time, progressing to the next when the current one is completed.

## Plan

### Update HairSystemChecklist.tsx for Marketing Checklist
Reuse the same progressive logic from `useDynamicTodos.ts`:

1. **Fetch all non-checklist dynamic lists** (same as now)
2. **Find the current active list** — the first list where not all items are completed (same logic as dashboard's `currentRegularIndex`)
3. **Display only that one list's items** under the Marketing Checklist, with a "List X of Y" indicator and progress bar
4. **When all items in the current list are checked off**, automatically show the next list (just like the dashboard)
5. **When all regular lists are done**, show the Ongoing Marketing list

### Technical Details
- In `HairSystemChecklist.tsx` lines 89-112: Instead of merging all dynamic list items into one flat list, apply the same filtering logic as `useDynamicTodos`:
  - Separate regular lists from "ongoing" lists
  - Find first incomplete regular list
  - Only include that list's items in the Marketing Checklist's items array
  - Use the active list's title as the section title
- Add a small "List X of Y completed" indicator above the items (matching dashboard style)
- Progress bar reflects only the current active list's completion

