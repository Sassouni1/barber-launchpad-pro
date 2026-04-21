

## Fix: Separate "Save Contact" from "Add to Wallet" flow

### The problem
Right now on `/card/:shortCode`, the "Save Contact" action only downloads the vCard (`.vcf` file) — it never actually triggers the Apple/Google Wallet pass generation. When we combined them into one button, the wallet step got dropped. Users get a contact saved to their phone but never get the branded wallet pass.

### Recommended approach: Sequential auto-prompt (best UX)

One tap on **"Save Contact"** → vCard downloads immediately → 10 seconds later a wallet prompt automatically slides up → user taps once more to add the branded pass to Apple/Google Wallet. Manual fallback button stays visible the whole time in case they dismiss the prompt or want to do it later.

This is better than a single combined button because:
- iOS/Android block "two downloads in one tap" (the second gets silently killed by the browser)
- Saving a contact and adding a wallet pass are two distinct OS-level actions that need their own user gesture
- The 10-second delay gives the contact-save sheet time to close before the wallet sheet opens

### Changes to `src/pages/CardView.tsx`

1. **`handleSaveContact`** — keep it focused: just download the vCard and set `contactSaved = true`. Remove any wallet-trigger side effects.
2. **New auto-prompt effect** — when `contactSaved` flips to `true`, start a 10-second timer that opens a modal/sheet titled "Add to Wallet" with platform-aware buttons (Apple Wallet on iOS, Google Wallet on Android, both on desktop). Cleanup on unmount.
3. **Manual fallback** — the existing "Add to Wallet" button stays visible below "Save Contact" so users who dismiss the prompt (or want to skip the contact step) can still trigger it directly.
4. **Wallet handlers** — `handleAddToWallet` (Apple) and `handleAddToGoogleWallet` (Google) already exist and call the right edge functions. Just verify they're wired to both the auto-prompt modal buttons AND the manual fallback button.

### Files touched
- `src/pages/CardView.tsx` — flow logic + auto-prompt modal (using existing `Dialog` component)

### Files NOT touched
- `supabase/functions/generate-apple-pass/index.ts` — already works
- `supabase/functions/generate-google-wallet-pass/index.ts` — already works
- `src/lib/generateVCard.ts` — already works
- `src/hooks/useBusinessCard.ts` — no changes needed

### Acceptance check
- Tap "Save Contact" → `.vcf` downloads, contact-save sheet appears
- ~10 seconds later → "Add to Wallet" prompt auto-opens
- Tap Apple/Google Wallet button → branded pass downloads/opens
- Manual "Add to Wallet" button still works independently at any time
- Dismissing the auto-prompt does not break the manual button

