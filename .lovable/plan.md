

## Plan: Reliable Combined Save Contact Flow

### Problem
The current implementation uses arbitrary `setTimeout` delays to chain wallet pass + vCard downloads. This is unreliable — browsers may block the second action, and timing varies.

### Solution
Replace the timer-based approach with a **two-step sequential flow with user confirmation**:

1. **First tap "Save Contact"** → downloads the vCard immediately
2. **After vCard downloads**, the button transforms to **"Add to Wallet"** (Apple/Google depending on device) with a brief toast: "Contact saved! Add to your wallet too?"
3. **Second tap** → triggers the wallet pass

This ensures both actions succeed because each gets its own user-initiated gesture (browsers require user gestures for downloads/redirects).

### Changes

**`src/pages/CardView.tsx`**
- Add a `contactSaved` state boolean
- First click: `downloadVCard(card)` → set `contactSaved = true` → show toast
- Button text/icon changes to "Add to Wallet" (show Apple Wallet or Google Wallet icon based on platform)
- Second click: triggers wallet pass generation
- On desktop (no wallet): single click just downloads vCard, no second step
- Optional: auto-reset `contactSaved` after 30s if they don't tap again

### Result
- No timers, no race conditions
- Each action gets its own user gesture (browser-compliant)
- Clear UX feedback at each step

