

## Speed Up Brand Photo Image Generation

### Root Cause
Three problems combine to make generation painfully slow:

1. **3 parallel AI image calls** -- each takes 30-60 seconds, and firing them simultaneously triggers Google's rate limit (429 RESOURCE_EXHAUSTED), causing failures and retries
2. **Massive payloads** -- brand photos are converted to base64 at full resolution (often 3-5MB+ each), making the request body enormous and slow to upload
3. **No timeout handling** -- if a call hangs, there's nothing to abort it

### Changes

**File: `src/pages/Marketing.tsx`**

1. **Downscale before base64** -- Before converting brand photos to base64, resize them to max 1200px wide using the existing `resizeImage` helper. This cuts payload size by 80-90%.

2. **Sequential generation** -- Instead of firing all 3 image requests simultaneously (which triggers rate limits), generate them one at a time. Each image appears as it completes so users see progress:
   - Image 1 starts immediately
   - Image 2 starts after Image 1 finishes
   - Image 3 starts after Image 2 finishes

3. **Progress feedback** -- Show which image is currently being generated (e.g., "Generating image 1 of 3...") so users know it's working

### Technical Details

**Downscale helper (reuse existing `resizeImage`):**
```
// Before sending to edge function:
const resized = await resizeImage(imgUrl, 1200, 1200); // max 1200px
const b64 = await urlToBase64(resized);
generateSlot(varType, i, sizeVal, b64);
```

**Sequential loop:**
```
// Replace parallel fire-and-forget with sequential async/await
for (let i = 0; i < Math.min(brandCount, 3); i++) {
  const imgUrl = realImages[i];
  if (imgUrl) {
    const resized = await resizeImage(imgUrl, 1200, 1200);
    const b64 = await urlToBase64(resized);
    await generateSlot(varType, i, sizeVal, b64); // wait for completion
  }
}
```

This requires `generateSlot` to return a Promise (currently it's fire-and-forget). The edge function call already returns a promise -- we just need to await it.

### Expected Improvement
- Payload size: ~5MB down to ~200KB per image
- No more rate limit errors (sequential calls)
- Total time: ~90-120 seconds for 3 images (vs hanging/failing)
- Users see each image appear as it finishes instead of waiting for all 3

