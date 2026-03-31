

# Add Next Call Countdown to Dashboard

## What
Show a compact "next group call" countdown widget on the Dashboard page, positioned below the DynamicTodoList.

## How

### New component: `src/components/dashboard/NextCallCountdown.tsx`
- Extract and reuse the countdown logic (`parseNextOccurrence`, `useCountdown`, timezone helpers) from `LiveCalls.tsx` into a shared utility or duplicate the small helpers inline.
- Fetch group calls via `useGroupCalls()`, find the one with the soonest next occurrence.
- Render a compact card showing: call title, day/time label, countdown (or "Live Now!"), and a "Join" link to `/live-calls`.
- Return `null` if no calls are scheduled.

### Update: `src/pages/Dashboard.tsx`
- Import and render `<NextCallCountdown />` after `<DynamicTodoList />`.

### Refactor: Extract shared countdown utils
- Move `DAY_MAP`, `TZ_TO_IANA`, `getTimezoneOffsetMs`, `parseNextOccurrence`, and `useCountdown` from `LiveCalls.tsx` into a shared file (e.g. `src/hooks/useCallCountdown.ts`) so both `LiveCalls.tsx` and the new dashboard widget reuse the same logic without duplication.

