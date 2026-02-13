

## Fix: Brand Images Should Preserve the Reference Photo, Not Recreate It

### Problem

When generating "brand" images (the ones that use a reference photo from the scraped website), the AI is ignoring the actual reference photo and generating a completely new AI image instead. The result looks like a "pure AI recreation" rather than a design built around the real photo.

This happens because:

1. The reference instructions say "incorporate the reference photo" but the layout instructions simultaneously say things like "features cinematic photography" and "full-bleed cinematic photo as background" -- the model interprets this as "generate new photography"
2. The prompt doesn't strongly enough distinguish between "edit/composite this existing photo" vs "create new imagery"
3. The model treats the reference image as style inspiration rather than literal content to preserve

### Solution

Strengthen the reference image prompt to make it absolutely clear the model must **preserve and use the exact provided photo** -- not generate new imagery. The key changes:

**1. Make the reference instruction the dominant directive**

Rewrite the reference instructions to be much more forceful:

- "DO NOT generate new photography. You MUST use the EXACT provided photo as-is."
- "The provided image is the final photo -- do not redraw, recreate, or reimagine it."
- "Your job is ONLY to add text overlays, borders, and layout elements around/on top of this photo."

**2. Modify the layout descriptions for reference mode**

When a reference image is provided, adjust the layout instructions to describe compositions around an existing photo rather than asking for new photography:

- Layout 0: "Left panel with text, right panel shows THE PROVIDED PHOTO"
- Layout 1: "THE PROVIDED PHOTO as the full background with dark gradient overlay and text"  
- Layout 2: "THE PROVIDED PHOTO centered in a frame with text above and below"

**3. Remove conflicting "cinematic photography" language for reference mode**

Strip out any instructions that could be interpreted as "generate new photos" when a reference is provided.

### Technical Details

**File: `supabase/functions/generate-marketing-image/index.ts`**

- Update the `referenceInstructions` block (lines 80-87) to strongly enforce photo preservation
- Create reference-specific layout variants that reference "THE PROVIDED PHOTO" instead of "cinematic photography"
- Add explicit negative instructions: "Do NOT generate, recreate, or reimagine the photo content"
- Keep the non-reference (pure AI) path unchanged

