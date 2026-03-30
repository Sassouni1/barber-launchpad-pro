

# Show All Dynamic Lists in Marketing Checklist (with Lock/Greyed Out States)

## What Changes
Update the Marketing Checklist section in `HairSystemChecklist.tsx` to show **all** dynamic lists at once, but with visual states:

- **Completed lists**: Items shown with strikethrough/checkmarks, collapsed or visually marked as done
- **Current active list**: Fully interactive, normal styling
- **Future locked lists**: Greyed out, non-interactive, with a lock icon

## Technical Plan

### Update `src/pages/HairSystemChecklist.tsx` (lines 89-140)

Replace the "show only active list" logic with "show all lists, styled by state":

1. **Keep fetching all non-checklist dynamic lists** (already doing this)
2. **Instead of picking one active list**, map ALL dynamic lists into the Marketing Checklist's items, grouped by list title
3. **Add a state flag per group**: `completed`, `active`, or `locked`
   - Walk through regular lists in order; first incomplete one is `active`, everything before is `completed`, everything after is `locked`
   - Ongoing list: `active` only when all regular lists are done, otherwise `locked`

### Update the rendering section (lines 361-455)

For the Marketing Checklist, render each dynamic list as a distinct section:

- **Completed sections**: Show list title with a green checkmark badge, items with strikethrough text, checkboxes checked and disabled
- **Active section**: Normal interactive items (current behavior)
- **Locked sections**: Grey/opacity-50 styling, items visible but checkboxes disabled, subtle lock icon on the section header

### Files to Edit
- `src/pages/HairSystemChecklist.tsx` — query logic + rendering

