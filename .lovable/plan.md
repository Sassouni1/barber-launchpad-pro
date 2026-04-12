

## Plan: Separate Wallet Pass QR from Rewards QR

### Problem
Both the wallet pass QR and the rewards dashboard QR point to `/rewards/join/:userId`. The wallet pass should point to the business card instead.

### Changes

**1. Update Apple Wallet pass (`supabase/functions/generate-apple-pass/index.ts`)**
- Change the QR code value from `/rewards/join/:userId` to `/card/:shortCode` (the business card page)
- Update the alt text from "Scan to Join Rewards" to something like "Scan to View Card"
- The `short_code` is already available from the `business_cards` row being fetched

**2. Update Google Wallet pass (`supabase/functions/generate-google-wallet-pass/index.ts`)**
- Same change: QR points to `/card/:shortCode` instead of `/rewards/join/:userId`

**3. No changes needed to:**
- The rewards dashboard share section (already correctly points to `/rewards/join/:userId`)
- The `RewardsJoin.tsx` page
- The `CardView.tsx` page

### Result
- **Wallet pass QR** → opens business card (marketing/discovery)
- **Rewards share QR** → opens rewards signup (loyalty program)

Two distinct purposes, no duplication.

### Technical detail
Both edge functions already query the `business_cards` table and have access to `short_code`. The change is just swapping the QR URL string in each function.

