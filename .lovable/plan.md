

## Fix: 1 of 3 Layouts Still Generates AI Images Instead of Using Reference Photo

### Root Cause
Layout 0 already has a `hasReference` branch that explicitly tells the AI to use the reference photo. Layouts 1 and 2 do not -- they use generic wording like "cinematic photo as background" and "centered rectangular photo inset." The global reference instructions help one of them work, but one layout's wording is ambiguous enough that the AI ignores the reference and generates its own image.

### Fix
Add `hasReference` conditional branches to layouts 1 and 2 (matching the pattern layout 0 already uses), so when a reference photo is provided, every layout explicitly says to use it.

### Technical Change

**File: `supabase/functions/generate-marketing-image/index.ts`** -- Update the `layouts` array (lines 88-94):

Layout 1 (index 1, full-bleed):
- With reference: "Full-bleed: Use the provided reference photo as the full background. Apply a heavy dark gradient overlay (70% opacity) on areas where text will go, but keep the subject clearly visible. Headline centered in bold uppercase. The reference photo MUST be shown completely -- never crop either side of a before-and-after transformation."
- Without reference: Keep existing cinematic photo version.

Layout 2 (index 2, framed):
- With reference: "Framed composition: dark background with the provided reference photo centered as a rectangular inset (white or gold thin border). Headline ABOVE the photo. Brand name and tagline BELOW. The reference photo MUST be shown completely -- never crop either side of a before-and-after transformation."
- Without reference: Keep existing version.

Layout 0 stays unchanged (already correct).

This ensures all 3 layout indices explicitly instruct the AI to use the reference photo when one is provided.
