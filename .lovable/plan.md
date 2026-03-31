

# Add Feedback Viewer to Admin Dashboard

## Current State
The `ContactSection` component correctly inserts into `dashboard_feedback` with `user_id`, name, email, topic, and message. RLS policies allow admins to SELECT all rows. The data storage is solid.

## What's Missing
There's no place for you (the admin) to actually see the submissions.

## Plan

### New Component: `src/components/admin/FeedbackViewer.tsx`
- Query `dashboard_feedback` ordered by `created_at desc`
- Show a table with columns: Date, Name, Email, Topic, Message
- Badge color per topic for quick scanning
- Empty state when no feedback yet

### Add to Admin Dashboard (`src/pages/admin/AdminDashboard.tsx`)
- Import and render `<FeedbackViewer />` in a new glass-card section after the App Settings block
- Title: "Member Feedback" with a MessageSquare icon

No database changes needed — the table and RLS policies already exist and are correct.

