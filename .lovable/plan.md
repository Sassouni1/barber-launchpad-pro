

## Add Multiple Ways to Add Clients to Rewards Tracker

Three methods to get clients into your rewards list: quick add, QR code, and shareable link.

### 1. Self-Registration Edge Function

Create a backend function (`register-reward-client`) that accepts a client's name, phone, and email along with the member's user ID. This allows unauthenticated clients to add themselves without needing a login. The function uses the service role key to insert into `reward_clients` on behalf of the member.

### 2. Public Self-Registration Page

Create a new page at `/rewards/join/:userId` that shows a simple branded form where a client enters their name and phone/email. On submit, it calls the edge function above. No login required -- the client just sees a "You're signed up!" confirmation. This route will be public (no `ProtectedRoute` wrapper).

### 3. QR Code Generation on Rewards Page

On the member's Rewards Tracker page, add a "Get QR Code" button that generates a QR code pointing to the member's personal join link (`/rewards/join/{userId}`). Uses the existing `qrcode.react` library already installed. The member can download or screenshot the QR to display in their shop.

### 4. Shareable Link with Copy Button

Next to the QR code, show the join URL as text with a "Copy Link" button. Members can text or DM this to clients.

### 5. Quick Add Simplification

Simplify the existing "Add Client" dialog to default to just a name field with phone/email collapsed behind an "Add details" toggle, making it faster for in-person additions.

### Files to Create/Edit

- **`supabase/functions/register-reward-client/index.ts`** -- Edge function for public client self-registration
- **`supabase/config.toml`** -- Add `verify_jwt = false` for the new function (NOTE: this file updates automatically, we just need the function config)
- **`src/pages/RewardsJoin.tsx`** -- Public-facing self-registration form page
- **`src/pages/Rewards.tsx`** -- Add QR code display, shareable link section, and simplify the add client dialog
- **`src/App.tsx`** -- Add public route for `/rewards/join/:userId`

### Technical Details

- The edge function validates input (name required, trims whitespace, checks length limits) and inserts into `reward_clients` using the service role key
- Duplicate detection: if a client with the same name + phone already exists for that member, show a friendly "you're already registered" message instead of creating a duplicate
- QR code uses the same `qrcode.react` library and styling conventions as the existing QR Codes page
- The join page uses the app's published URL as the base for the QR/link (pulled from `window.location.origin`)

