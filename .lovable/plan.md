

# Add Countdown Timer to Group Calls

## Overview
Add a live countdown timer to each group call card showing days, hours, minutes, and seconds until the next occurrence of that call's scheduled day/time.

## Approach
Since calls are recurring weekly (e.g. "Monday at 7pm EST"), calculate the next occurrence of that day+time from now, then count down with a `setInterval` every second.

## Changes

### 1. `src/pages/LiveCalls.tsx`
- Add a `useCountdown` helper hook that:
  - Parses `day_of_week` + `time_label` to find the next occurrence datetime
  - Uses `setInterval(1000)` to update days/hours/minutes/seconds remaining
  - Shows "Live Now!" or "Starting soon!" when within a few minutes
- Display countdown below each call's day/time text as styled segments (e.g. `2d 14h 32m 18s`)
- Parse time_label loosely (e.g. "7pm EST", "3:30pm CST") — best-effort since it's free-text

### 2. Time parsing strategy
- Extract hour/minute/am-pm from `time_label` using regex
- Map `day_of_week` string to JS day number (0=Sun, 6=Sat)
- Calculate next occurrence: if that day+time is in the past this week, add 7 days
- Handle timezone from the label (EST/CST/PST) by converting to UTC offset

### Visual design
Each call card gets a countdown row with styled number blocks:
```
┌─────────────────────────────────────────────────┐
│ 🎥  Group Call                    [Join Zoom] │
│     Monday at 7pm EST                          │
│     ⏱ 2d  14h  32m  18s                       │
└─────────────────────────────────────────────────┘
```

