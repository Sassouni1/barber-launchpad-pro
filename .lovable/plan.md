

## Fix: Full-Bleed Layout Cuts Off Faces

### Problem
The full-bleed background layout (layout index 1) instructs the model to fill the entire canvas with the reference photo, which conflicts with Rule #1 (full head visibility). The model stretches or crops the photo to fill the frame, cutting off heads. This is the style shown in your reference images — photo as background with text overlay — and it should work well, but the "filling the canvas" language causes cropping.

### Solution

**File: `supabase/functions/generate-marketing-image/index.ts`**

1. **Rewrite layout 1 (full-bleed) reference instructions (line 102)** to prioritize head visibility over canvas fill:
   - Change "placed as large full-bleed background filling the canvas" to "placed as a large background element that covers most of the canvas while keeping every person's full head, hair, and face visible with breathing room"
   - Add: "If the photo does not naturally fill the entire canvas without cropping any person's head, use a dark premium background (#0D0D0D) behind the photo and let the photo sit within the frame at the largest size that keeps all heads fully visible"
   - Keep the rest: headline overlay with dark gradient, brand name + CTA at bottom, gold outer frame

2. **Add explicit anti-crop instruction for layout 1**: "For this layout, it is better to have dark padding around the edges than to crop any part of a person's head or hair. Scale the photo down 10-20% if needed to guarantee full head visibility."

3. **Keep the before-and-after scaling rules** already in the layout (70% max panel height, 15% padding above).

### What stays the same
- Layout 0 (split) and layout 2 (centered editorial) unchanged
- All headline pools, palette logic, retry logic unchanged
- The overall aesthetic (dark background, gold accents, text overlay) unchanged
- The layout still produces the full-bleed look the user wants — just with safer framing

