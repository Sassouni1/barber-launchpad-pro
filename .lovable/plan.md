

## Fix Fake Person Generation + Head Cropping

### Problem 1: Fake person still appearing (Image 2)
The reference photo is added as raw image data with no surrounding text context. The model sees: [image bytes] then [huge text prompt]. For some layouts, it loses track of the reference and generates a new person.

### Problem 2: Head still getting cropped (Image 1)
The split panel layout says "right 75% is the reference photo" but doesn't strongly enough enforce scaling down to show full head with breathing room.

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

#### 1. Sandwich the reference image with text anchors

Currently the parts array is: `[inlineData, text_prompt]`

Change it to: `[text_anchor_before, inlineData, text_anchor_after, text_prompt]`

Add a text part BEFORE the image:
```
"REFERENCE PHOTO BELOW — this is a real photograph. Memorize it. You will embed these EXACT pixels into your design."
```

Add a text part AFTER the image:
```
"REFERENCE PHOTO ABOVE — you just saw the real photo. Every human in your output MUST be these exact pixels. If your output contains ANY person not from this photo, your output is INVALID. Now proceed with the design instructions:"
```

This sandwiches the image with reinforcement so the model can't "drift" from the reference as it reads the layout instructions.

#### 2. Make each layout's scaling instruction more aggressive for head visibility

Update the three layout strings to add explicit padding percentages:

- **Layout 0 (Split panel)**: Change "scale it so the ENTIRE photo is visible" to "scale it to 85% of the panel height so there is at least 7-8% padding on ALL sides — the full head, all hair, and forehead must have visible empty space above, below, left and right"

- **Layout 1 (Full-bleed)**: Change "scale and position it so the ENTIRE photo is visible" to "scale the photo to at most 80% of canvas height, centered, so every person's complete head and hair has visible breathing room on all edges"

- **Layout 2 (Centered editorial)**: Change "scale it so the ENTIRE photo is visible" to "scale the photo to at most 75% of the canvas height so there is generous padding above every person's head and on all sides"

#### 3. Add explicit anti-generation instruction per layout

Each layout already has "REMINDER: The person in this photo is REAL" at the end. Strengthen this to: "ABSOLUTE RULE: You MUST use the reference photo's exact pixel data. If you cannot embed it, show NO PEOPLE. Generating a new face is an immediate failure — even if it 'looks similar.'"

### What stays the same
- All 16 rules unchanged
- All 7 verification steps unchanged
- Headline pools, retry logic, color grading
- Preamble and referenceInstructions text
- Gold accent rule (Rule 16)

