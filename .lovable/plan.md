

## Fix: Blue Backgrounds from Photo Backdrop Sampling Override

### Problem
Rule 2 currently has two conflicting instructions:
1. "Background tone for THIS variation: warm black / neutral black / cool charcoal"
2. "Sample the dominant background color from the photo itself and use that tone as the canvas fill"

The second instruction wins every time. If the reference photo has a blue studio backdrop (which most do), the model extends that blue across the entire canvas -- making the tone rotation pointless. Layout 0 says "Absolutely NO blue" but the photo-sampling instruction immediately contradicts it.

### Solution

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Rewrite Design Rule 2 (line 258)** so the tone rotation takes priority and the photo blending adapts to IT, not the other way around:

Current:
> "Background tone for THIS variation: [tone]. ... sample the dominant background color from the photo itself and use that tone..."

New:
> "Background tone for THIS variation: [tone]. The canvas background MUST match this tone direction. When placing a reference photo, blend the edges of the photo seamlessly into this canvas tone -- soften, feather, or fade the photo's edges so it transitions smoothly into the prescribed background tone. Do NOT let the photo's own studio backdrop color take over the entire canvas. The canvas tone instruction above is the authority; the photo blends INTO it, not the other way around."

This keeps the seamless transition (no harsh boundary) but forces the canvas to follow the warm/neutral/cool rotation instead of always becoming whatever color the studio backdrop was (usually blue).

### What changes
- Rule 2 reworded so tone rotation is authoritative
- Photo blending direction reversed: photo fades into canvas tone, not canvas adopts photo tone

### What stays the same
- The 3-tone rotation array (warm black, neutral black, cool charcoal)
- All layout structures, gold accents, typography rules
- Reference photo preservation (no modifications to the person)
- Anti-crop and head visibility logic
- Everything else in the prompt

