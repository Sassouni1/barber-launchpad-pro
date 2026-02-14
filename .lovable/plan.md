

## Ditch Hybrid Compositing — Send Real Photos to the AI

### Problem
The magenta placeholder + canvas compositing approach is producing terrible results: magenta showing through, awkward photo placement, and broken layouts. The whole approach needs to go.

### New Approach
Go back to sending the actual reference photo directly to the AI model (Gemini 3 Pro) and use extremely forceful prompt language demanding it incorporate the REAL photo as-is. No canvas tricks, no placeholders. The AI gets the photo and must use it.

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

1. **Remove all hybrid/magenta logic:**
   - Remove the `useHybridCompositing` variable (line 87)
   - Remove the condition that skips sending the reference image (lines 189-200) — always send it when available
   - Remove `hybrid` from the response (line 281)

2. **Rewrite layout descriptions for reference images (lines 90-97):**
   - Replace all magenta placeholder instructions with direct photo usage instructions:
     - **Split layout with ref:** "Right 75% shows the PROVIDED REFERENCE PHOTO exactly as-is — do NOT generate a new person or alter the photo."
     - **Full-bleed with ref:** "Use the PROVIDED REFERENCE PHOTO as the full-bleed background — do NOT generate a new person."
     - **Framed with ref:** "Center frame contains the PROVIDED REFERENCE PHOTO exactly as-is — do NOT generate a new person."

3. **Rewrite `referenceInstructions` (lines 105-122):**
   - Replace the magenta placeholder instructions with aggressive photo-preservation language:
     - "You are given a REAL PHOTO. You MUST use this EXACT photo in the design. Do NOT generate, recreate, reimagine, or approximate the person in the photo. The reference photo must appear UNCHANGED — same face, same hair, same angle, same lighting. Treat it as a placed photograph in a graphic design layout, not as inspiration."

**File: `src/pages/Marketing.tsx`**

4. **Remove the entire `compositeImage` function** (lines 60-143)

5. **Remove the compositing call in `generateSlot`** (lines 382-390) — just use the image directly from the AI response

6. **Remove `hybrid` handling** — no need to check for `data.hybrid` anymore

### Deployment
Redeploy `generate-marketing-image` edge function.

### Why This Should Work Better
Gemini 3 Pro *does* accept inline images — we were already sending them before the hybrid change. The issue was weak prompting. By being extremely explicit ("use this EXACT photo, do NOT generate a new person"), and removing all the magenta noise from the prompt, the model has a much better shot at incorporating the real photo. And even if it sometimes approximates, that's far better than broken magenta rectangles showing through.
