

## Fix: Remove signOut and Use Direct Session Replacement

The current code calls `signOut()` before `verifyOtp()`, which triggers `onAuthStateChange` with a null user, causing `ProtectedRoute` to redirect to `/login` and unmount everything before `verifyOtp` ever runs.

### The Fix (ViewSwitcher.tsx only)

In `handleImpersonate`, make two small changes:

1. **Remove** the `await supabase.auth.signOut()` line entirely -- `verifyOtp()` already replaces the current session automatically
2. **Replace** `navigate('/dashboard')` with `window.location.href = '/dashboard'` to force a full page reload, ensuring all cached state (React Query, AuthContext) resets cleanly with the new user

### Technical Detail

```text
Before (broken):
  signOut() -> AuthContext detects null user -> ProtectedRoute redirects to /login
  -> verifyOtp() never completes

After (fixed):
  verifyOtp(token_hash) -> session replaced in-place
  -> window.location.href forces full reload -> app boots with new user session
```

No edge function changes needed -- it already returns `token_hash` and `email` correctly.

