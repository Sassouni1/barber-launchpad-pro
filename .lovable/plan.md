

# Dashboard Contact/Feedback Section

## What It Does
Adds a card below the group call + continue learning row with a simple form where members can reach out. It auto-fills their name and email from their profile, and they pick a topic and write a message. Submissions are saved to a new `dashboard_feedback` table and the admin can view them.

## Topics (radio/select)
- Suggestion topic for group call
- I need help or have a question
- How can we make your experience better / what would help you more

## UI
- New component `src/components/dashboard/ContactSection.tsx`
- Glass-card style matching the rest of the dashboard
- Name + email fields pre-filled (read-only or editable) from the user's profile
- Topic selector (radio group or select)
- Message textarea
- Submit button with gold-gradient styling
- Success toast on submit

## Database
- New table `dashboard_feedback`:
  - `id` (uuid, PK)
  - `user_id` (uuid, references profiles)
  - `name` (text)
  - `email` (text)
  - `topic` (text)
  - `message` (text)
  - `created_at` (timestamptz)
- RLS: authenticated users can insert their own rows (`user_id = auth.uid()`), admins can select all

## Dashboard Layout (`src/pages/Dashboard.tsx`)
Add `<ContactSection />` after the two-column grid:
```text
ShippingNotification
WelcomeHero
DynamicTodoList
[NextCallCountdown | ContinueLearning]
ContactSection          <-- new
```

## Technical Details
- Component reads `user` from `useAuth()` and queries `profiles` for `full_name` and `email` to pre-fill
- On submit, inserts into `dashboard_feedback` with `supabase.from('dashboard_feedback').insert(...)`
- Toast confirmation: "Your message has been sent!"
- No email sending for now — admins view submissions in the database (can add admin view or email notification later)

