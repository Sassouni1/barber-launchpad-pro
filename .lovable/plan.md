# Persistent hair-system order total

## Implementation
- Add a sticky bottom summary throughout system details, delivery, review, and Stripe payment.
- Reuse the existing client-side pricing lines so the displayed total stays aligned with checkout selections.
- Show “Current total,” USD amount, item count/compact summary, and an expandable itemized breakdown.
- Preserve the existing detailed review breakdown and payment behavior.
- Add enough bottom spacing for the bar and mobile navigation so fields and buttons remain reachable.

## Verification and release
- Check the order flow at desktop and 319×635 mobile sizes, including expanded/collapsed summary and live total updates.
- Confirm the production build succeeds.
- Publish the frontend, then verify the live member site reflects the new summary without overlapping controls.
