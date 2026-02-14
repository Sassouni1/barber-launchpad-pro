

## Auto-Retry Failed Image Generation Slots

### Problem
When generating a batch of images, some slots fail (due to rate limits, Gemini flakiness, or missing image data in the response). Currently, a failed slot is just marked as "failed" with no retry, so you end up with fewer images than expected.

### Solution
Add automatic retry logic (up to 2 retries per slot) inside the `generateSlot` function in `src/pages/Marketing.tsx`.

### Technical Details

**File: `src/pages/Marketing.tsx`**

Update the `generateSlot` function (lines 264-308) to wrap the API call in a retry loop:

- On failure (error response, no image, or resize failure), wait a few seconds and retry
- Up to 2 retries per slot (3 total attempts)
- Delay increases between retries: 5s after first failure, 10s after second
- Only mark as `'failed'` after all retries are exhausted
- Log retry attempts to console for debugging

The rest of the batching logic (pairs of 2 with 3s delay) stays unchanged.

### What This Fixes
- Intermittent Gemini failures will be automatically retried instead of permanently failing
- Rate limit (429) responses get a longer backoff before retry
- Users should see all 3 images complete successfully much more consistently

