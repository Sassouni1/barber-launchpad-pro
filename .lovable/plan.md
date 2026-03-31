

# Join Live Call Feature

## Overview
Add a "Join Live Call" navigation item above "Barber Launch Calls" in the sidebar that links to a new page showing the next upcoming group call (e.g. "Monday at 7pm EST") with a Zoom join button. Admins can manage the call schedule and Zoom link from the admin dashboard.

## Database

Create a `group_calls` table:
- `id` (uuid, PK)
- `title` (text) — e.g. "Group Call"
- `day_of_week` (text) — e.g. "Monday"
- `time_label` (text) — e.g. "7pm EST"
- `zoom_link` (text) — the Zoom URL
- `is_active` (boolean, default true) — show/hide from members
- `order_index` (integer, default 0)
- `created_at`, `updated_at` (timestamptz)

RLS: Anyone can SELECT. Admins can INSERT/UPDATE/DELETE.

## New Files

1. **`src/pages/LiveCalls.tsx`** — Member-facing page
   - Fetches active calls from `group_calls` ordered by `order_index`
   - Shows each call as a card: title, day/time, and a "Join Zoom Call" button linking to the Zoom URL
   - Shows "No upcoming calls scheduled" if empty

2. **`src/components/admin/GroupCallsManager.tsx`** — Admin component
   - List existing calls with inline edit/delete
   - Add new call form: title, day of week (dropdown), time label, zoom link, active toggle
   - Reorder support

3. **`src/hooks/useGroupCalls.ts`** — Data hook
   - `useGroupCalls()` — fetch all active calls (member view)
   - `useGroupCallsAdmin()` — fetch all calls + mutations for create/update/delete

## Modified Files

4. **`src/App.tsx`** — Add `/live-calls` route (protected)

5. **`src/components/layout/Sidebar.tsx`** — Add `NavItem` for "Join Group Call" with `Video` icon above "Barber Launch Calls". Fetch first active call to show dynamic label like "Monday at 7pm EST" as subtitle.

6. **`src/components/layout/MobileNav.tsx`** — Add matching mobile nav entry

7. **`src/pages/admin/AdminDashboard.tsx`** — Add `GroupCallsManager` component section for managing calls

## Navigation Structure (Sidebar)
```text
...
Marketing Tools ▾
  AI Social Media
Products ▾
  ...
Join Group Call        ← NEW (Video icon, links to /live-calls)
Barber Launch Calls ▾
  Schedule Call 1 on 1
Level 1 Cert
```

## Technical Details
- The sidebar will show the next call info dynamically from the `group_calls` table
- Zoom link opens in a new tab (`target="_blank"`)
- Admin can add multiple scheduled calls (recurring schedule display)
- Uses existing `app_settings`-style patterns for simple CRUD

