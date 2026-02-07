

## Problem

GHL (the webhook source) is firing twice for the same order, approximately 4 seconds apart. The first payload is missing the nested order metadata needed to extract an `external_order_id`, so it gets inserted with `NULL`. The second payload has the full data and a valid `external_order_id`, but the dedup check finds no match (since the first record has `NULL`), resulting in a duplicate.

Evidence from the database:
- Row 1: created at 03:13:35, `external_order_id = NULL`
- Row 2: created at 03:13:40, `external_order_id = 6986adde8e6898327c54ad29`

## Solution

Add a **time-window dedup fallback** in the `receive-order` edge function. When no `external_order_id` match is found, check if an order with the same `customer_email` was inserted within the last 60 seconds. If so, skip the insert.

Additionally, backfill the `external_order_id` on the earlier record when the second (complete) payload arrives, so data is not lost.

## Technical Details

**File: `supabase/functions/receive-order/index.ts`**

After the existing `external_order_id` dedup check, add a second check:

```
-- Pseudocode --
If no duplicate found by external_order_id:
  Query orders WHERE customer_email = X
    AND created_at > (now - 60 seconds)
    AND external_order_id IS NULL
  If match found:
    - Update that row's external_order_id (if we have one now)
    - Return early as deduplicated
```

This handles both scenarios:
- First call (no external ID) inserts normally
- Second call (has external ID) finds the recent row, patches it with the ID, and skips inserting

**Cleanup:** Delete the current duplicate row (`623df83b-3585-46e7-8c45-5f24ca79881c` -- the one with NULL external_order_id) since the other row has the complete data.

