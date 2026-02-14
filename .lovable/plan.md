

## Fix Before-and-After Photo Handling

### Changes to `supabase/functions/generate-marketing-image/index.ts`

**Change 1: Remove forced "BEFORE" / "AFTER" labels**
In the `referenceInstructions` block (lines 113-119) and all three layout definitions (lines 89-97), remove every mention of adding "BEFORE" and "AFTER" labels. The photos speak for themselves.

**Change 2: Allow split layout for before-and-after photos**
Currently, when a before-and-after photo is detected, all three layouts OVERRIDE to a stacked layout. This is wrong -- the split layout (text on left, photo on right) works perfectly as shown in the reference images. The key rule is simply: show BOTH people. Update the layout overrides so:
- Split layout: Keep text-on-left, photo-on-right. Just add the rule that both subjects in the comparison must be fully visible -- never zoom into or crop out either person.
- Full-bleed and Framed: Keep the stacked override but remove the forced labels.

**Change 3: Stronger hair protection rule**
Update rule #8 (line 181) to explicitly include hair/top of head:
- "Never crop or cut off faces or hair -- if a person is in the image, their full head from the TOP OF THEIR HAIR down to their chin must be fully visible. Leave vertical padding above the tallest point of the hair."

Also update rule #11 (line 184) to reinforce: the top of the head/hair must never be clipped by the edge of the frame.

### Summary of prompt edits
- Lines 89-97: Remove OVERRIDE-to-stacked for split layout; remove "BEFORE"/"AFTER" label instructions from all layouts
- Lines 113-119: Remove forced "BEFORE"/"AFTER" labels; simplify to "show both sides, never crop either half"
- Line 181: Strengthen face/hair cropping rule to include top of hair with padding
- Line 184: Add "top of hair must not be clipped by frame edge"
- Redeploy edge function

