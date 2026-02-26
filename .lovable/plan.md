

## Rewards Tracker - Full Implementation

Everything needs to be created: database tables, page, hooks, and navigation links.

### 1. Database Migration

Create two tables with RLS:

- **`reward_clients`**: id, user_id, client_name, client_phone (nullable), client_email (nullable), created_at
- **`reward_visits`**: id, client_id (FK to reward_clients), user_id, visited_at, is_redemption (default false), created_at

RLS policies on both tables: users can only SELECT, INSERT, UPDATE, DELETE their own rows (`auth.uid() = user_id`).

Also insert an `app_settings` row for `reward_visits_required` with value `{"count": 10}`.

### 2. New Hook: `src/hooks/useRewards.ts`

- `useRewardClients()` - fetch all clients for current user with visit counts
- `useAddClient()` - mutation to add a new client
- `useLogVisit()` - mutation to log a visit for a client
- `useRedeemReward()` - mutation to insert a visit with `is_redemption = true`
- `useDeleteClient()` - mutation to delete a client and their visits

### 3. New Page: `src/pages/Rewards.tsx`

- Stats bar showing total clients and total rewards redeemed
- "Add Client" dialog/form (name required, phone/email optional)
- Client list with visual punch card (10 circles that fill up)
- "Log Visit" button per client
- "Redeem" button when punch card is full
- Delete client option
- Wrapped in `DashboardLayout`

### 4. Route in `src/App.tsx`

Add protected route: `/rewards` pointing to `Rewards` page.

### 5. Navigation Updates

**Sidebar (`src/components/layout/Sidebar.tsx`)**:
- Import `Gift` icon from lucide-react
- Add `NavItem` for `/rewards` with label "Rewards Tracker" after Marketing Tools and before Products

**Mobile Nav (`src/components/layout/MobileNav.tsx`)**:
- Add "Rewards Tracker" link with Gift icon to the mobile nav

