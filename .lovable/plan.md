

# Dashboard Layout: Side-by-Side Cards + Countdown Polish

## What Changes
1. **Two-column layout on desktop** — Place "Continue Learning" and "Next Call Countdown" side by side (grid) on screens ≥ 1024px; stack on mobile.
2. **Bigger countdown** — Increase the countdown numbers from `text-sm` to `text-lg`/`text-xl` with more padding and a subtle gold border/glow so they pop.
3. **Smaller button** — Change the "View Calls" button from full-width `size="lg"` to a compact inline button (`size="sm"` or `size="default"`, not full-width).

## Technical Details

### `src/pages/Dashboard.tsx`
- Wrap `<ContinueLearning />` and `<NextCallCountdown />` in a `<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">` so they sit side by side on desktop.

### `src/components/dashboard/NextCallCountdown.tsx`
- Countdown digits: bump to `text-lg font-bold`, add `border border-primary/30` and `bg-primary/10` for gold-tinted pill styling.
- Button: remove `w-full`, use `size="default"` with `gold-gradient` styling, keep it compact.

### `src/components/dashboard/ContinueLearning.tsx`
- No major changes needed; it already has a full card layout that will flex into the grid column.

