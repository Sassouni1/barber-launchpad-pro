

# Order Tracking System

## Overview
Build a complete order lifecycle: GHL form submission triggers a webhook that creates an order, the manufacturer sees and updates tracking numbers on a dedicated page, and users see their order history with shipping notifications.

## How It Works

**Order Flow:**
1. User submits the GHL order form
2. GHL sends a webhook to a backend function with order details
3. The system creates an order record linked to the user (matched by email)
4. The manufacturer logs into their special account and sees new orders at `/newtimes`
5. Manufacturer adds a tracking number
6. User sees "Order Shipped" notification on their dashboard + tracking link in their Orders page

## Database Changes

### New `orders` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | References the user's profile |
| customer_email | text | Email from GHL form (used for matching) |
| customer_name | text | Name from GHL form |
| order_details | jsonb | All form fields from GHL (flexible -- you tell us the fields later) |
| status | text | `pending`, `processing`, `shipped`, `delivered` |
| tracking_number | text | Nullable, added by manufacturer |
| tracking_url | text | Nullable, optional link |
| order_date | timestamptz | When the order was placed |
| created_at | timestamptz | Record creation |
| updated_at | timestamptz | Last update |

**RLS Policies:**
- Users can view their own orders
- Admins can view/update all orders
- The webhook function uses the service role key (bypasses RLS)

### New `manufacturer` role
Add `'manufacturer'` to the `app_role` enum so we can create a manufacturer account that can ONLY see the `/newtimes` page -- no access to admin, courses, or member content.

**Manufacturer RLS:**
- Manufacturer role can SELECT and UPDATE orders (to add tracking numbers)
- Cannot delete orders or access any other tables

## New Backend Function

### `receive-order` edge function
- Receives the webhook POST from GHL
- Validates the payload using a shared secret (you'll add a webhook secret in GHL)
- Extracts customer email and order details from the form data
- Looks up the user by email in the `profiles` table
- Creates an order record in the `orders` table
- You'll paste this URL into your GHL form's webhook settings

## New Pages

### `/orders` -- Member Orders Page
- Shows a list of the user's past orders (newest first)
- Each order shows: order date, status badge, order details, and tracking number (if available)
- If a tracking number exists, shows a "Track Order" button
- Accessible from the sidebar navigation

### `/newtimes` -- Manufacturer Orders Page
- Protected route requiring `manufacturer` role
- Shows a table of ALL orders sorted by newest first
- Columns: Customer Name, Email, Order Date, Order Details, Status, Tracking Number
- Each row has an "Add Tracking" button that opens an inline edit to enter a tracking number and optional tracking URL
- When tracking is added, the order status automatically changes to `shipped`

## Dashboard Notification
- On the user's dashboard, if any order has status `shipped` and hasn't been dismissed, show a banner at the top: "Your order has been shipped!" with a "View Tracking" button that links to `/orders`
- Add a `tracking_seen` boolean to the orders table so the notification can be dismissed

## Navigation Updates

### Sidebar
- Add "My Orders" link (Package icon) in the member navigation, below "Order Hair System"
- Add manufacturer check: if user has `manufacturer` role, show only the `/newtimes` link

### Mobile Nav
- Add "Orders" to the mobile navigation grid

### Admin Sidebar
- No changes needed -- manufacturer has their own dedicated route

## New Files
- `src/pages/Orders.tsx` -- member order history
- `src/pages/ManufacturerOrders.tsx` -- manufacturer tracking page
- `src/hooks/useOrders.ts` -- queries for orders
- `supabase/functions/receive-order/index.ts` -- webhook handler

## Modified Files
- `src/App.tsx` -- add routes for `/orders` and `/newtimes`
- `src/components/layout/Sidebar.tsx` -- add "My Orders" nav link
- `src/components/layout/MobileNav.tsx` -- add "Orders" to mobile grid
- `src/components/dashboard/WelcomeHero.tsx` or `Dashboard.tsx` -- add shipping notification banner
- `src/components/auth/ProtectedRoute.tsx` -- add `requireManufacturer` prop
- `src/contexts/AuthContext.tsx` -- check for manufacturer role

## Setup Steps (For You)
1. After we build this, you'll get a webhook URL
2. Go to your GHL form settings and add that URL as a webhook on form submission
3. Create a manufacturer account (email/password) and we assign it the manufacturer role
4. Share the login credentials + `/newtimes` URL with your manufacturer
5. You tell us the exact field names from your GHL form so we map them correctly into order details

## Technical Details

The `receive-order` edge function will:
```
POST /receive-order
Headers: x-webhook-secret: <your-secret>
Body: { ...GHL form fields }
```

It will use the service role key to bypass RLS and insert directly into the orders table, matching the customer email to find the user_id.

The manufacturer role gets a dedicated protected route check -- separate from admin -- so they can only access `/newtimes` and nothing else.

