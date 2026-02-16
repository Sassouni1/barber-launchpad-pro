

## Fix: Blue Photo Background Clashing with Black Layout Background

### Problem
When a reference photo has a dark-colored studio backdrop (like dark blue or dark gray), it clashes visually against the jet-black (#0D0D0D) layout background. The two different dark tones sitting next to each other look cheap and unpolished. The prompt currently says nothing about matching or blending these colors.

### Solution

**File: `supabase/functions/generate-marketing-image/index.ts`**

1. **Add a background-blending instruction to all 3 layouts** that have reference photos (lines 99, 102, 105):
   - Add to each layout: "If the reference photo has a visible studio backdrop or background color, extend or feather that same background color outward to fill the rest of the canvas so there is no harsh color boundary between the photo and the layout background. The surrounding area should seamlessly match the photo's own backdrop tone rather than defaulting to pure black."

2. **Update the design rules section** to add a new rule about background continuity:
   - "When placing a reference photo, sample the dominant background color from the photo itself and use that tone (not pure black) as the canvas fill behind and around the photo. This prevents jarring color mismatches between the photo backdrop and the layout background."

3. **Adjust the #0D0D0D fallback language** in layout 1 (line 102):
   - Change "use a dark premium background (#0D0D0D)" to "use the photo's own backdrop color extended outward, or if the photo has no clear backdrop, use a dark premium background (#0D0D0D)"

### What stays the same
- All 3 layout structures unchanged
- Gold accents, typography, headline pools
- Reference photo preservation rules (no modifications to the photo itself)
- Anti-crop and head visibility logic

