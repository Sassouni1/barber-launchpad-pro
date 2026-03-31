

# Smart Relative Day Labels for Next Group Call

## What It Does Now
The widget always shows the raw day name from the database — e.g. "Tuesday at 8:00 PM" — regardless of whether that's today, tomorrow, or 5 days away.

## What Changes
Replace the static day name with a smart relative label based on how far away the call is:

- **"Today"** — if the call is scheduled for today
- **"Tomorrow"** — if the call is scheduled for tomorrow  
- **"This Wednesday"** — if it's 2-6 days away (uses "This" + day name)

This makes the widget feel more natural and urgent — "Tomorrow at 8:00 PM" hits differently than "Tuesday at 8:00 PM".

## Technical Details

### `src/components/dashboard/NextCallCountdown.tsx`
- The `useMemo` that finds `nextCall` already computes the next occurrence date via `parseNextOccurrence`. Store that date alongside the call object.
- Add a helper function `getRelativeDayLabel(date: Date)` that compares the call date to today:
  - Same calendar day → `"Today"`
  - Next calendar day → `"Tomorrow"`  
  - Otherwise → `"This " + dayName` (e.g. "This Wednesday")
- Replace `{nextCall.day_of_week}` in the heading with the computed relative label.

### `src/hooks/useCallCountdown.ts`
- No changes needed — `parseNextOccurrence` already returns the correct `Date` object.

