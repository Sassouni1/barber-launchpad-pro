

## Fix Brand Image Generation + Allow Upload Before Website Analysis

### Problem 1: Brand Images Only Generate 1

`buildVariations` reads `allBrandImages` from the component closure, but it's called immediately after `setBrandProfile()` -- before React re-renders. So the scraped images list is still empty, and `brandCount = Math.max(0, 1) = 1`.

**Fix**: Pass the scraped images directly into `buildVariations` as a parameter instead of reading stale closure state. Compute the combined image list inside the function using the fresh brand profile data + current uploaded/removed state.

### Problem 2: Upload Only Available After Website Analysis

The entire Brand Assets card is wrapped in `{brandProfile && (...)}`, hiding the upload button until a website is analyzed.

**Fix**: Split the Brand Assets section into two parts:
- **Image upload area** -- always visible (even before website analysis), so users can upload their own photos first
- **Color palette selector + scraped images** -- only shown after website analysis (since palette data comes from scraping)

### Changes (single file: `src/pages/Marketing.tsx`)

1. **`buildVariations` signature change**: Accept images array as parameter
   ```
   buildVariations(bp, caption, combinedImages)
   ```
   Inside, compute `realImages` from the passed-in array instead of the stale `allBrandImages` closure.

2. **Callers pass fresh images**: In `generateContent`, after getting the brand profile, compute the image list from `bp.images` + `uploadedImages` - `removedImages` and pass it in. Same for the Regenerate button's call.

3. **Move upload UI outside the `brandProfile &&` gate**: Add an "Upload Your Images" section that's always visible above the Brand Assets card. The scraped images gallery and palette selector remain inside the `brandProfile &&` block.

4. **Merge galleries**: When `brandProfile` exists, show all images (scraped + uploaded) in one gallery. When no brand profile yet, show only uploaded images.

### What Doesn't Change

- Edge functions (no changes)
- AI generation prompts
- Card grid layout (2x2)
- Palette selector logic
- Caption generation
- Carousel / download / save

