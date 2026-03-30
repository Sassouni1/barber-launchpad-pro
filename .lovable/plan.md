

# Fix "Last Active" to Track Real Activity

## Problem
"Last Active" only checks timestamps from quiz attempts, lesson completions, and todo completions. If a user is actively browsing the app but hasn't completed anything recently, it shows stale data.

## Solution
Track the user's last login/session by updating a `last_active_at` column on the `profiles` table whenever they load the app.

### Database Migration
- Add `last_active_at timestamptz` column to `profiles` table

### `src/contexts/AuthContext.tsx` (or wherever the auth session is established)
- When a user session is detected (on login or app load), update `profiles.last_active_at = now()` for the current user
- Throttle this to once per session (use a ref or sessionStorage flag so it doesn't fire on every re-render)

### `src/hooks/useAdminMembers.ts`
- In the `lastActive` calculation (lines 205-213), also include `profile.last_active_at` in the `allDates` array
- This way the most recent of login, quiz, lesson, or todo activity wins

### No other changes needed
- The Members table already displays `lastActive` and sorting already works on it

