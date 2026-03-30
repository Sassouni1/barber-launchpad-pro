

# SMS Overdue Reminders via GHL API (New Users Only)

## Overview
Send up to 2 SMS reminders via GoHighLevel API v2 to users who are overdue on their dynamic todo lists. Only applies to users who created their account **after 2026-03-30** (today). Uses a tracking table to enforce the 2-message cap and progress-based reset.

## Changes

### 1. Database migration
- Add `phone` column (text, nullable) to `profiles` table
- Create `sms_reminders` table:
  - `id` uuid PK
  - `user_id` uuid (not null)
  - `reminder_count` int (default 0)
  - `last_sent_at` timestamptz
  - `last_list_id` uuid
  - `last_progress_snapshot` int (completed items when last sent)
  - `created_at` timestamptz (default now())
- RLS: users read own row, admins read all

### 2. Collect phone on signup
- Add optional phone field to `CreateAccount.tsx`
- Save to `profiles.phone` via metadata or post-signup update

### 3. Add GHL API key secret
- Use `add_secret` to request `GHL_API_KEY` from the user (their GHL API v2 key)

### 4. Edge function: `send-overdue-reminders`
- Runs daily via `pg_cron`
- Queries users where `profiles.created_at > '2026-03-30'` AND `phone` is not null
- For each user: determine current dynamic todo list, check if overdue (`due_days` vs days since account creation)
- Check `sms_reminders` — skip if `reminder_count >= 2`
- If progress changed since last reminder, reset counter
- If still overdue and no progress: send SMS via GHL API v2 (`POST /conversations/messages`), increment counter
- SMS content:
  - **Reminder 1**: "Hey {name}! You're making great progress. Don't forget to complete your current tasks — you're almost there!"
  - **Reminder 2**: "Just a friendly reminder — your training tasks are waiting. Log in here: {app_url}"

### 5. Schedule cron job
- Enable `pg_cron` and `pg_net` extensions
- Schedule daily at 10am: `select cron.schedule(...)` calling the edge function

### 6. Admin visibility (optional)
- Show reminder count on Members detail panel

## Technical Detail
- GHL API v2 endpoint: `POST https://services.leadconnectorhq.com/conversations/messages` with `Authorization: Bearer {GHL_API_KEY}` and body `{ type: "SMS", contactId: "...", message: "..." }`
- The cutoff date `2026-03-30` is hardcoded — legacy users are never eligible
- The edge function uses service role key to query all profiles (bypasses RLS)

