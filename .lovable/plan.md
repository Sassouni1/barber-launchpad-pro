

## Handle Before-and-After Reference Photos

### Problem
When a before-and-after (side-by-side) reference photo is used, the current layouts can crop one side out or squeeze the wide image into a square/vertical frame, losing the transformation comparison.

### Solution

**File: `supabase/functions/generate-marketing-image/index.ts`**

**Change 1: Add before-and-after detection instruction to the prompt**
Add a new section in the prompt (after the reference photo instructions) that tells Gemini to detect if the reference photo is a horizontal before-and-after composition (two subjects side by side, or a split showing transformation). When detected, it must:
- Show the COMPLETE photo -- both the left side and the right side, never cropping either
- Use a wide horizontal slot for the photo (full width of the image)
- Place ALL text (headline, brand name, CTA) ABOVE and/or BELOW the photo strip -- never on it
- Optionally add "BEFORE" and "AFTER" labels at the top edge of each half

**Change 2: Add before-and-after-specific layouts**
Update all 3 layout variants to include a before-and-after override rule:
- **Split layout**: Instead of 25/75 text-photo split, switch to a stacked layout -- text banner on top, full-width before-and-after photo in center, CTA banner on bottom
- **Full-bleed layout**: Top 20% for text, center 60% for the full before-and-after photo (uncropped, edge to edge), bottom 20% for CTA
- **Framed layout**: Dark background, headline above, full-width framed before-and-after photo in center, CTA below

**Change 3: Add explicit "never show just one side" rule**
Add to the CRITICAL DESIGN RULES section:
- "BEFORE-AND-AFTER PHOTOS: If the reference photo shows a side-by-side comparison (before and after), you MUST display BOTH sides completely. Never crop, cut, or hide either the left or right half. The entire horizontal photo must be visible edge-to-edge. Use a wide rectangular photo slot spanning the full width of the image."

### What This Changes
- The AI will recognize horizontal before-and-after compositions and adapt the layout to give them full width
- Both sides of the transformation will always be visible
- Text stays in safe zones above and below the photo strip
- No risk of only showing one side of the comparison

### Files Changed
- `supabase/functions/generate-marketing-image/index.ts` (prompt updates in layouts, reference instructions, and design rules)
- Redeploy edge function
