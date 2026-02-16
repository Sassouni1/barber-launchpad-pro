

## Fix: Remove Conflicting Backdrop-Sampling from Layout Descriptions

### Problem
The last change only fixed Rule 2 (line 258) but left all three layout descriptions (lines 107, 110, 113) with the old "extend the photo's backdrop outward" language. The model sees both instructions, and the layout-specific ones win because they're more detailed and appear first in the prompt. Result: blue studio backdrops still take over the canvas.

### Solution

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Layout 0 — Split layout (line 107)**

Remove:
> "If the reference photo has a visible studio backdrop or background color, extend or feather that same background color outward to fill the rest of the canvas so there is no harsh color boundary between the photo and the layout background. The surrounding area should seamlessly match the photo's own backdrop tone rather than defaulting to pure black."

Replace with:
> "Blend and feather the photo's edges into the prescribed canvas background tone (see Design Rule 2) so there is no harsh boundary. The canvas tone takes priority — the photo fades into it, not the other way around."

**2. Layout 1 — Full-bleed (line 110)**

Remove:
> "use the photo's own backdrop color extended outward as padding behind the photo, or if the photo has no clear backdrop, use a dark premium background (#0D0D0D)"

And remove:
> "If the reference photo has a visible studio backdrop or background color, extend or feather that same background color outward to fill the rest of the canvas so there is no harsh color boundary between the photo and the layout background."

Replace both with:
> "use the prescribed canvas background tone (see Design Rule 2) as padding behind the photo. Feather the photo's edges into this canvas tone seamlessly."

**3. Layout 2 — Centered editorial (line 113)**

Remove:
> "If the reference photo has a visible studio backdrop or background color, extend or feather that same background color outward to fill the rest of the canvas so there is no harsh color boundary between the photo and the layout background. The surrounding area should seamlessly match the photo's own backdrop tone rather than defaulting to pure black."

Replace with:
> "The canvas background should use the prescribed tone from Design Rule 2. Feather the photo's edges into this canvas tone so there is no harsh boundary."

### Why this fixes it
Rule 2 already has the correct instruction (canvas tone is authoritative, photo blends into it). The problem is that all three layouts still had the OLD instruction telling the model to do the opposite. With this change, the layouts and Rule 2 are aligned — every instruction points the same direction: warm/neutral/cool canvas tone first, photo fades into it.

### What stays the same
- Rule 2 wording (already correct from the last change)
- The 3-tone rotation array (warm black, neutral black, cool charcoal)
- All layout structures, gold accents, typography rules
- Reference photo preservation and anti-crop logic
- Non-reference layout variants (lines 108, 109, 114)

