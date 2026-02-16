

## Fix Palette Logic + Add Metallic Gold Gradient + True Black

### What's changing

**The palette selector already works correctly** -- gold is the default, website colors are only available when a website has colors. No forced overrides per image index. The previous suggestion to force index 0 to always be gold was wrong and will NOT be implemented.

The real changes are in the edge function prompt to improve the visual quality:

### 1. Update gold description to metallic gradient (edge function)

**File: `supabase/functions/generate-marketing-image/index.ts`**

In the `brandColorBlock` when `useGold` is true, replace the flat `#D4AF37` references with a metallic gradient description:

- Primary/Accent becomes: "METALLIC GOLD GRADIENT -- transitions from deep burnished bronze (#8B6914) through rich gold (#D4AF37) to bright luminous gold (#F0D060). Every gold element must have this gradient shimmer like polished gold foil, never flat single-tone gold."

### 2. Darken the background to true black (edge function)

Update Rule #2 in the prompt:
- Change `#1A1A1A to #0D0D0D` to `#0A0A0A to #0D0D0D`
- Add: "as dark as possible, like black velvet or luxury card stock. The background should be indistinguishable from pure black."

### 3. Update Rule #13 (Gold Accents) to mandate gradient (edge function)

Replace flat gold references with metallic gradient language so every gold element (borders, text highlights, CTA bars, dividers) gets the shimmer treatment.

### 4. Update palette swatch preview color (frontend)

In `src/pages/Marketing.tsx`, update the gold swatch preview from flat `#D4AF37` / `#1A1A1A` to use a CSS gradient on the gold swatch so users see the metallic look in the selector too.

### What stays the same
- Gold is already the default palette choice -- no change needed
- Website colors option only appears when colors are found -- no change needed
- User's palette choice applies to all 3 images -- no forced overrides
- All layout logic, headline pools, retry logic, verification steps unchanged

