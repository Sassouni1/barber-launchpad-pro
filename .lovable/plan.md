
## Fix: Stop All Images From Using the Same Headline

### Problem
All 3 generated images show "INSTANT DENSITY" because:
1. The text content generator produces a caption starting with "INSTANT DENSITY. UNDETECTABLE FINISH."
2. That same caption is passed as `variationContent` to all 3 image generation calls
3. The image prompt includes `variationContent.substring(0, 200)` as the "theme/mood"
4. Despite the instruction "Create your OWN headline", the AI sees "INSTANT DENSITY" right there and copies it every time

### Fix (Edge Function Only)

**`supabase/functions/generate-marketing-image/index.ts`** -- Two changes:

1. **Index-based headline rotation**: Instead of showing ALL 19 headline examples to the AI, use the `index` parameter (0, 1, 2) to select a DIFFERENT subset of ~6 headlines for each image. This forces each image to draw from a different pool.

2. **Stronger anti-copy instruction**: Change the prompt from "Create your OWN headline inspired by this theme" to explicitly say: "Do NOT use any words or phrases from the theme text below as your headline. Instead, pick ONE of the headline examples listed and adapt it." Strip the first line of `variationContent` (which contains the headline the AI keeps copying) so it only sees the body text as context.

### What This Means
- Image 0 gets headlines like "REAL HAIRLINE. REAL CONFIDENCE." / "THINNING TO THICK." / etc.
- Image 1 gets headlines like "BUILT TO BLEND." / "NO SCARS. NO DOWNTIME." / etc.  
- Image 2 gets headlines like "ENGINEERED HAIRLINES." / "PRECISION INSTALLED." / etc.
- The AI never sees the caption's opening headline phrase, so it can't copy it

### Files Changed
- `supabase/functions/generate-marketing-image/index.ts`
