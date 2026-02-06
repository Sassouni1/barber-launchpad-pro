

# UTM Parameter Order Matching

## What You Need To Do (the finger part)

In your GHL form/workflow, you don't need to change anything special. The app will automatically append `?user_id=abc-123-xyz` to the GHL form URL when a logged-in user views the order page. GHL should pass that through as a hidden field in the webhook payload.

**One thing to verify in GHL:** Make sure your webhook action is set to pass through URL parameters / hidden fields. Most GHL forms do this by default.

## What I'll Do (the code part)

### 1. Update the Order Page (`src/pages/OrderHairSystem.tsx`)
- Import the `useAuth` hook to get the current logged-in user's ID
- Append `?user_id={their-id}` to the GHL iframe URL so it gets passed along with the form submission

### 2. Update the Webhook (`supabase/functions/receive-order/index.ts`)
- Check for `user_id` in the incoming GHL payload first (this is the UTM value passed through)
- If found and valid, use it directly -- no guessing needed, 100% accurate match
- Keep the existing email matching as a fallback just in case
- Matching priority:
  1. `user_id` from UTM parameter (direct, guaranteed match)
  2. Email match (existing fallback)
  3. No match -- order saved with `user_id = null` for manual linking

No database changes needed.

