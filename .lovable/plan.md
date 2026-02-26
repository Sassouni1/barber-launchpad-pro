

## QR Code Generator with Permanent Links

### Overview
Build a QR code generator where each code points to a redirect URL on your own domain. You can change where a QR code leads at any time without reprinting it. Includes scan tracking.

### What You'll Get
- A new **QR Codes** page in the sidebar
- Create QR codes by entering a label and destination URL
- Download QR codes as images to print or share
- Edit where any QR code points to (the printed code stays valid forever)
- See how many times each QR code has been scanned
- Delete QR codes you no longer need

### How "Forever" Works
Instead of encoding `instagram.com/yourbiz` directly into the QR code, it encodes `barber-launchpad-pro.lovable.app/r/abc123`. When someone scans it, they hit your site, which looks up `abc123` in the database and redirects them. If you change your Instagram handle, just update the destination -- same QR code, new destination.

---

### Technical Details

**1. Database Migration**
Create `qr_links` table:
- `id` (UUID, PK)
- `user_id` (UUID, not null)
- `short_code` (text, unique, not null)
- `destination_url` (text, not null)
- `label` (text, not null)
- `scan_count` (integer, default 0)
- `created_at`, `updated_at` (timestamps)

RLS policies:
- Users can SELECT/INSERT/UPDATE/DELETE their own rows (`auth.uid() = user_id`)
- Public SELECT by short_code needed for redirects -- handled via a `security definer` function instead, so the table stays locked down

A `security definer` function `resolve_qr_link(code text)` will look up the destination and increment scan count without requiring auth.

**2. New dependency**
- `qrcode.react` for client-side QR code rendering

**3. New files**
- `src/pages/QRCodes.tsx` -- Main page: create, list, edit, download, delete QR codes
- `src/pages/QRRedirect.tsx` -- Minimal page at `/r/:shortCode` that calls `resolve_qr_link`, increments scan count, redirects to destination
- `src/hooks/useQRLinks.ts` -- CRUD hooks using Supabase client

**4. Modified files**
- `src/App.tsx` -- Add `/qr-codes` (protected) and `/r/:shortCode` (public) routes
- `src/components/layout/Sidebar.tsx` -- Add "QR Codes" nav item with QrCode icon
- `src/components/layout/MobileNav.tsx` -- Add QR Codes link for mobile

**5. Redirect flow**
```text
User scans QR -> barber-launchpad-pro.lovable.app/r/abc123
  -> QRRedirect page loads
  -> Calls resolve_qr_link('abc123') (security definer, no auth needed)
  -> Function returns destination_url, increments scan_count
  -> window.location.href = destination_url
  -> If invalid code, shows "This QR code is no longer active"
```

**6. QR Code page features**
- Form: label + destination URL -> generates unique 8-char short code
- List view: label, destination, scan count, created date
- Edit button: change destination URL (short code stays the same)
- Download button: exports QR code as PNG
- Delete button with confirmation
- Copy link button for sharing without QR image

