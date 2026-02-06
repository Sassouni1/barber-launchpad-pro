

## Fix: Impersonate User (No Redirects, No Popups)

The current approach generates a magic link URL and tries to navigate to it. This fails because the Supabase `/auth/v1/verify` redirect flow doesn't reliably establish a session in the Lovable preview iframe environment.

**New approach:** Skip redirects entirely. The edge function will return the raw token, and the frontend will call `supabase.auth.verifyOtp()` directly to establish the session in-place. No navigation, no popups -- just a seamless session swap.

---

### Changes

**1. Edge Function (`supabase/functions/impersonate-user/index.ts`)**

- Instead of building a redirect URL, return the `token_hash` and `email` directly in the response
- Remove the redirect URL construction logic

**2. Frontend (`src/components/layout/ViewSwitcher.tsx`)**

- After receiving `token_hash` and `email` from the edge function:
  1. Call `supabase.auth.signOut()` to clear the current admin session
  2. Call `supabase.auth.verifyOtp({ token_hash, type: 'email' })` to establish the target user's session
  3. Navigate to `/dashboard` using `react-router` or `window.location`
- The `AuthContext` listener (`onAuthStateChange`) will automatically pick up the new session and update the UI

### Why This Works

- `verifyOtp` with `token_hash` directly creates a session on the client without any browser redirects
- The `onAuthStateChange` listener in `AuthContext` will detect the new user and re-check roles/status
- No popup blockers, no iframe restrictions, no redirect chain issues

---

### Technical Details

Edge function response shape changes from:
```json
{ "success": true, "url": "https://...", "target_email": "..." }
```
to:
```json
{ "success": true, "token_hash": "abc123...", "email": "user@example.com" }
```

Frontend flow:
```text
Click member -> Call edge function -> Get token_hash
-> signOut() -> verifyOtp({ token_hash, type: 'email' })
-> Session established -> Navigate to /dashboard
```

