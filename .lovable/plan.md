

## Make Borders Palette-Aware and Optional

### Problem
Two issues with borders right now:
1. The layout descriptions hardcode "Gold border" even when the user chose the website palette (should use brand colors instead).
2. Borders are forced on 2 out of 3 layouts — you want them to be a natural design choice, appearing roughly 1 in 4 images.

### Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Remove hardcoded border references from layout strings (lines 88-97):**

- **Split layout with reference (line 90):** Remove "Gold border around the entire image." — keep the dotted divider only.
- **Split layout without reference (line 91):** Remove "Thin gold border around the entire image." — keep the dotted divider only.
- **Framed layout with reference (line 96):** Change "white or gold thin border" to just "subtle thin border" (no color specified).
- **Framed layout without reference (line 97):** Same change.
- **Full-bleed (lines 93-94):** No change — already borderless.

**2. Add a palette-aware global border rule in CRITICAL DESIGN RULES (after line 184):**

A new rule that uses the existing `accentColor` variable so it respects the palette choice:

> "BORDERS: Outer borders are a creative choice, not a default. Most images (roughly 3 out of 4) should have NO outer border — let the design breathe edge-to-edge. Only add a thin border (2-3px) when it genuinely enhances the composition. When you do use a border, use the accent color (${accentColor}) or white. Never use thick or heavy borders."

This way:
- If the user chose gold palette, `accentColor` is `#D4AF37` (gold) so borders will be gold when they appear.
- If the user chose website palette, `accentColor` is whatever their brand's accent color is.
- Borders only show up when the AI thinks it fits — roughly 1 in 4 images.

**3. Redeploy the edge function.**

