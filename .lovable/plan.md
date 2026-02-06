

## Fix: Wrong OTP Type in verifyOtp Call

### Root Cause

The edge function generates a token using `generateLink({ type: 'magiclink' })`, but the frontend calls `verifyOtp({ token_hash, type: 'email' })`. The type parameter must match the generation type. Using `'email'` causes verifyOtp to silently fail (the error is caught and should show a toast, but the dialog closing at the same time makes it easy to miss).

### The Fix (ViewSwitcher.tsx, single line change)

Change `type: 'email'` to `type: 'magiclink'` in the `verifyOtp` call:

```typescript
// Before (broken):
const { error: otpError } = await supabase.auth.verifyOtp({
  token_hash: data.token_hash,
  type: 'email',       // <-- wrong type
});

// After (fixed):
const { error: otpError } = await supabase.auth.verifyOtp({
  token_hash: data.token_hash,
  type: 'magiclink',   // <-- matches generateLink type
});
```

Also move the toast and dialog close to AFTER the verifyOtp succeeds, so if it fails the error toast is visible while the dialog is still open.

### Technical Detail

```text
Edge function: generateLink({ type: 'magiclink' })  -->  token_hash
Frontend:      verifyOtp({ token_hash, type: 'magiclink' })  -->  session established
               window.location.href = '/dashboard'  -->  full reload as new user
```

One line change in `ViewSwitcher.tsx`, no edge function changes needed.

