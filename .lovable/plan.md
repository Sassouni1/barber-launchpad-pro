

# Make Marketing Checklist Show All Dynamic To-Do Items

## Problem
The dashboard's dynamic to-do lists (stages 1-5 + Ongoing Marketing) contain all the tasks, but the Marketing Checklist page only pulls items from the "Ongoing Marketing" list. The user wants everything from the dynamic to-do flow to also appear in the Marketing Checklist.

## Plan

### 1. Update HairSystemChecklist.tsx query logic
When loading the Marketing Checklist, fetch items from **all** non-checklist dynamic to-do lists (the same ones the dashboard uses), not just the "Ongoing Marketing" list.

- Change the current logic that only fetches the "Ongoing Marketing" list ID
- Instead, fetch all `dynamic_todo_lists` where title does NOT contain "checklist" 
- Include all their item IDs when querying `dynamic_todo_items`
- Group/display items under their original list titles (e.g., "Hair Training: Week 1-2", "Consultations & Sales", etc.) as section headers within the Marketing Checklist

### 2. Display structure
Items will appear grouped by their source list title, preserving the order. Each list becomes a section within the Marketing Checklist, so users see the same progression as the dashboard but in one consolidated view. Progress stays synced since both views use the same `item_id` references in `user_dynamic_todo_progress`.

### Technical Details
- In `HairSystemChecklist.tsx` lines 56-66: Replace the "Ongoing Marketing" lookup with a query for all non-checklist lists
- Lines 88-93: Update the item filtering to map items from all dynamic lists into the Marketing Checklist, grouped by source list title using `section_title` overrides
- No database changes needed — same items, same progress table

