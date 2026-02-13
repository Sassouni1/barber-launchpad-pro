

## Reduce Images from 3 to 2 Per Variation Type

### What Changes

Reduce image generation from 3 to 2 per variation type, cutting total API calls from 12 to 8. Also make them sequential with a delay to avoid rate limiting.

### Changes in `src/pages/Marketing.tsx`

**1. Variation cards initialization (lines 237-240)**
- Change `images` arrays from `[null, null, null]` to `[null, null]`

**2. Image slicing (line 235)**
- Change `imagesForGeneration.slice(0, 3)` to `imagesForGeneration.slice(0, 2)`

**3. Loop limits for generation calls (lines 270, 280-297)**
- Change all `3` caps to `2` in the generation loops and the `totalForType` calculation
- Brand Square/Story: `Math.min(brandCount, 2)` instead of `3`
- AI Square/Story: loop `i < 2` instead of `i < 3`

**4. Make generation sequential**
- Convert `generateSlot` to return a Promise
- Queue all 8 calls sequentially with a ~3-second delay between each to stay under Google's 10 RPM free tier limit
- Show progress text ("Generating image 2 of 8...")

