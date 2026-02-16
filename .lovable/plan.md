

## Fix Fake People, Cropping, and Excessive Contrast

### Problems
1. **Fake person generated** -- despite strict rules, the AI still created an AI-generated person in one of the three images
2. **Before-and-after photo cropped** -- one side of the transformation was cut off
3. **Contrast too high** -- the "dramatic cinematic color grading" and "push the contrast hard" language went too far, making images look overprocessed

### Root Causes
- The color grading instructions say "push the contrast hard" and mention it in 4+ places (layouts + Rule 5), which compounds
- The anti-fake-person rules are extensive but the model still occasionally ignores them; the layout instructions themselves say things like "cinematic photography" for the no-reference path, which may bleed into reference mode
- Before-and-after cropping persists because the layout says "fill most of the right side" which conflicts with Rule 13

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Tone down color grading (lines 93-96 and line 205)**

Remove all "deep teal shadows, warm amber highlights, high contrast" from the layout descriptions. Keep color grading only in Rule 5 but soften it:

- Layouts 0, 1, 2: Remove all color grading language from layout descriptions. Layouts should describe composition only, not color treatment.
- Rule 5 (line 205): Change from "Push the contrast hard" to "Apply subtle cinematic color grading — slightly warm highlights, slightly cool shadows, natural-looking contrast. The look should feel polished and editorial, NOT over-processed or heavy-handed. Avoid extreme teal-and-orange looks. The photo should still look natural and real."

**2. Strengthen anti-fake-person enforcement in layouts (lines 93-96)**

Add an explicit reminder at the end of each reference-photo layout:

- Layout 0: Append "REMINDER: The person in this photo is REAL — use their exact pixels. Do NOT generate a new person."
- Layout 1: Same reminder
- Layout 2: Same reminder

**3. Fix before-and-after cropping in Layout 0 (line 93)**

Change "it should fill most of the right side as the HERO element" to "if it is a before-and-after photo, scale it down enough to show BOTH sides completely with no cropping on any edge. Otherwise, fill most of the right side."

**4. Add a layout-level before-and-after override to all 3 layouts**

Prepend each reference layout with: "IMPORTANT: If the reference photo is a before-and-after (two sides), override the layout below — center the photo at a size that shows both sides fully, then place text above or below."

### What stays the same
- Rules 9, 13, 14 and their text (already strong enough)
- Verification checklist
- Retry logic, base64 fetching, headline pools
- Everything outside the prompt construction

