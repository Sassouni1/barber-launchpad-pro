

## Parallel-2 Image Generation with Progress

### Approach
Process image generation jobs in **pairs of 2** with a 3-second delay between each pair, instead of fully sequential (slow) or all-at-once (rate-limited).

### Changes (single file: `src/pages/Marketing.tsx`)

**1. Batch processing in pairs**
- Build the full list of generation jobs (brand slots + AI slots, typically 6 total)
- Process them 2 at a time using `Promise.all` on each pair
- Wait 3 seconds between each pair
- Result: 3 batches of 2 instead of 6 sequential calls -- cuts total time from ~18s to ~9s

**2. Failure handling**
- When an image request fails (429 or other error), mark the slot with `"failed"` instead of leaving it `null`
- This ensures the loading state always resolves, even if some images fail
- The UI can show a subtle "failed" indicator on those slots

**3. Progress indicator**
- Add `generationProgress` state: `{ current: number, total: number }`
- Update after each batch completes
- Display "Generating image X of Y..." in the UI so it never looks stuck

### Why 2 at a time?
- 10 RPM limit / 2 requests per batch = 5 batches per minute max
- With 3s delay between batches, we hit ~4 batches per minute -- safely under limit
- Total time for 6 images: ~12 seconds (vs ~18s sequential, vs instant-but-failing parallel)

### No backend changes needed
