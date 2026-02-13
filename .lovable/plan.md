
## Problem: Text Placement Over Faces/Hair Despite Instructions

### Root Cause
The prompt has TEXT PLACEMENT PRIORITY rules (lines 160-172), but Gemini 3 Pro Image doesn't reliably follow layout constraints when compositing text and images. Additionally:

1. **Layout instructions don't guarantee safe zones**: The 25/75 split layout assumes the reference photo stays in the right 75%, but if Gemini generates a different-looking person or repositions elements, text can still overlap faces.

2. **Reference photos are reimagined, not embedded**: Gemini generates new images "inspired by" the reference rather than inserting the actual photo. So even when you say "use this photo," it creates a new person with similar features—text placement rules don't apply to the generated person.

3. **Text placement priority is too soft**: The rule says "identify empty areas" but Gemini interprets "area" loosely. It needs an **absolute rule**: "Top X% and Bottom Y% of the image are RESERVED for text ONLY. No faces, hair, or bodies in these zones."

### Solution: Three-Part Fix

**Part 1: Absolute Text Zones** (lines 160-162)
Replace the "scan and identify" language with hard geometric constraints:
```
TEXT PLACEMENT PRIORITY: Create fixed text zones based on the layout:
- For split layouts: Text MUST be in the left 25-40% panel ONLY (completely dark background, zero people)
- For framed layouts: Text MUST go ABOVE and BELOW the framed photo (dark background areas, not adjacent to face)
- For full-bleed layouts: Reserve top 15% and bottom 20% for text ONLY. Keep center 70% for the person.
Never place text, gradients, or decorative elements over any part of a person's face, hair, neck, or body.
```

**Part 2: Stricter Reference Photo Language** (lines 105-111)
Add a "no reimagining" clause:
```
REFERENCE PHOTO INSTRUCTIONS:
You have been given a reference photo. This is the ONLY photo that should appear in the final image.
- CRITICAL: Do NOT generate, recreate, or reimagine the person. The photo must show THIS EXACT PERSON with their exact face, hair, skin tone, and appearance—not an AI approximation.
- Insert the reference photo directly into the design. Do not alter, regenerate, or stylize the person.
- You may apply minor color grading to the photo to match the theme, but the person themselves must be identical.
- All text, gradients, and graphics must be placed in separate background panels or zones—never on the person.
```

**Part 3: Explicit Layout Guardrails** (lines 90-97)
Make each layout description include explicit "text-free zones":
```
Split layout: left 25% dark panel is TEXT ONLY (no people, no faces). Right 75% is the reference photo only. Gold border and decorative line divider keep them separate.

Full-bleed: Top 15% reserved for text (dark overlay, no people). Center 70% shows the person clearly. Bottom 20% for CTA (dark overlay, no people).

Framed: Dark background surrounding a centered photo frame. ALL text (headline, brand, CTA) goes ABOVE the frame (top) and BELOW the frame (bottom) in dark zones. Nothing on the sides or overlapping the frame.
```

### Why This Matters
Gemini struggles with soft constraints ("try to avoid text on faces"). Hard geometric rules ("text ONLY in top 15% and bottom 20%") are easier for the model to follow. Combined with stricter "don't reimagine the person" language, this should reduce the instances of text landing on faces or hair, and reduce fake people being generated.

### Implementation
**File: `supabase/functions/generate-marketing-image/index.ts`**
- Update lines 90-97 (layout instructions) with explicit text-free zones
- Update lines 105-111 (reference photo instructions) with "no reimagining" clause
- Update lines 160-162 (TEXT PLACEMENT PRIORITY) with absolute zone definitions
- Redeploy edge function

