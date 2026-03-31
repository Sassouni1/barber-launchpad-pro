

# Fix Countdown Accuracy — Structured Time Input

## Problem
The countdown parses free-text `time_label` (e.g. "7pm EST") with regex, which is fragile and leads to inaccurate countdowns.

## Solution
Replace the free-text time input in the admin form with structured selectors: hour, minute, AM/PM, and timezone dropdowns. Store these as separate columns so the countdown logic never needs to parse text.

## Database Changes

Add columns to `group_calls`:
- `call_hour` (integer, 1-12)
- `call_minute` (integer, 0 or 30)
- `call_ampm` (text, 'AM' or 'PM')
- `call_timezone` (text, e.g. 'EST', 'CST', 'PST')

Keep `time_label` as a computed display string (e.g. "7:00 PM EST") generated on save, so the member-facing page still has a readable label.

## File Changes

### 1. `src/components/admin/GroupCallsManager.tsx`
- Replace free-text "Time" input with 3 dropdowns: Hour (1-12), Minute (00/15/30/45), AM/PM
- Add timezone dropdown: EST, EDT, CST, CDT, MST, MDT, PST, PDT
- Auto-generate `time_label` from selections on save (e.g. "7:00 PM EST")
- Save structured fields (`call_hour`, `call_minute`, `call_ampm`, `call_timezone`) alongside `time_label`

### 2. `src/pages/LiveCalls.tsx`
- Update `parseNextOccurrence` to read structured columns (`call_hour`, `call_minute`, `call_ampm`, `call_timezone`) instead of regex-parsing `time_label`
- Direct integer math — no parsing needed, no ambiguity
- Keep display using `time_label` for the UI text

### 3. `src/hooks/useGroupCalls.ts`
- Update `GroupCall` interface to include `call_hour`, `call_minute`, `call_ampm`, `call_timezone`

## Result
- Admin picks time with dropdowns — no typos possible
- Countdown uses exact integers — no regex parsing, always accurate
- Member page still shows readable "Monday at 7:00 PM EST"

