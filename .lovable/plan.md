

## Restore Layout Variety + Add Strongest-Ever Face/Head Visibility Rule

### What's changing

**File: `supabase/functions/generate-marketing-image/index.ts`**

#### 1. Restore 3 distinct layout styles (currently all look the same)

Remove the "IMPORTANT: If the reference photo is a before-and-after... override the layout" prefix from all 3 layouts. Instead, embed before-and-after scaling naturally within each layout's own composition:

- **Layout 0 (Split panel)**: Left 25% dark panel, right 75% photo. For before-and-after, scale within the right panel so both sides show. No layout override.
- **Layout 1 (Full-bleed)**: Photo fills the canvas as background. For before-and-after, scale/position so both sides are visible. Text in upper area with gradient.
- **Layout 2 (Centered editorial)**: Dark background, photo centered. For before-and-after, scale down to fit both sides.

All 3 keep the anti-fake-person reminder at the end.

#### 2. Add the strongest possible face/head visibility rule

Add a new **Rule 15** — the single most emphatic rule in the prompt:

> **"ABSOLUTE NON-NEGOTIABLE — FULL HEAD VISIBILITY: The ENTIRE head, ALL hair, the COMPLETE face, and the full forehead of EVERY person in the image MUST be 100% visible at all times — in single photos AND in before-and-after photos. This applies to EVERY edge of the image (top, bottom, left, right). If ANY part of ANY person's head, hair, or face is cut off, cropped, or touches any edge, the image is an IMMEDIATE FAILURE. Scale the photo DOWN until every person's full head fits with visible breathing room on all sides. There are ZERO exceptions to this rule. This overrides all layout, composition, and framing decisions."**

#### 3. Add matching verification step

Add verification step 7:

> "Check EVERY person's head in the image. Can you see their COMPLETE hair, forehead, and face with space around it on ALL sides? If ANY part is cut off at ANY edge, scale smaller and redo."

### What stays the same
- All other rules (1-14)
- Verification steps 1-6
- Headline pools, retry logic, color grading, everything else

