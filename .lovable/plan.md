

## Restore Premium Full-Bleed Design Aesthetic

### Problem
The recent anti-cropping fixes overcorrected by telling the AI to shrink the reference photo to 75-85% of the canvas as an "inset." This killed the bold, full-bleed look that made the original designs premium. The reference images show:

- Photo fills the right side edge-to-edge (or nearly so)
- Text on a dark panel to the left with white + gold alternating words
- Thin gold outer frame border wrapping the entire composition
- Decorative gold dotted-line divider between text and photo panels
- Photo is the HERO element, not a shrunken thumbnail

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Rewrite all three layout descriptions (lines 91-97)**

Restore full-bleed photo placement while keeping the anti-cropping rules in the PERSON FRAMING section (Rule 9) to handle head/hair visibility:

- **Layout 0 (split, with reference):** Left 25% dark panel with headline stacked vertically in bold white + gold text. Right 75% is the reference photo used LARGE — it should fill most of the right side. Thin gold border around the entire image. Decorative gold dotted line divider between text panel and photo.
- **Layout 1 (full-bleed):** Reference photo as large background. Headline in bold uppercase positioned in the upper-left or upper area with a subtle dark gradient behind the text for readability. Brand name + CTA at bottom. Thin gold outer frame.
- **Layout 2 (framed editorial):** Dark background with the reference photo as a large centered element with a thin white or gold border around just the photo. Headline ABOVE in large bold text. Brand name + CTA BELOW. Clean editorial layout.

Key difference: remove the "shrink to 85%/80%/75%" language. Instead, let the photo be big and bold. The anti-cropping rules in Rule 9 and Rule 13 still protect against cutting off heads/hair.

**2. No changes to Rules 9, 13, 14 or the verification checklist**

Those rules still apply and will prevent cropping. The fix is purely about layout intent — letting the photo be the hero again instead of a shrunken inset.

### Technical Details

The layout strings in the `layouts` array (lines 91-97) will be rewritten to match the aesthetic of the reference images while keeping all other prompt rules intact. The key shift is from "shrink and pad" to "fill and frame."
