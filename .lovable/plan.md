

## Fix: AI-Generated People Instead of Reference Photos in Stories

### The Problem

The reference photo is being sent correctly, but Gemini 3 Pro Image Preview is ignoring it and generating AI people instead. This is a known limitation of image generation models -- they tend to "redraw" people rather than compositing the original photo. The story format (9:16) makes this worse because the aspect ratio change gives the model more creative freedom to regenerate.

### Root Cause

The current prompt treats the reference photo as something to "embed" in a composition, but Gemini's image generation mode doesn't work like a compositor -- it generates everything from scratch, using the reference as loose inspiration rather than exact pixel data.

### Proposed Changes

#### 1. Reorder parts: text prompt BEFORE reference image (edge function)

Currently the reference image is pushed to `parts[]` first, then the text prompt. Some models respond better when the instruction comes first, followed by the image. This gives the model context about what it should do with the image before it sees it.

**File: `supabase/functions/generate-marketing-image/index.ts`**

Move the `parts.push({ text: prompt })` call to happen BEFORE the reference image inline data, so the model reads "here's what you must do" before seeing the photo.

#### 2. Restructure the prompt for "photo-first" compositing language (edge function)

Replace "embed the reference photo" language with stronger compositing instructions:
- "PASTE this photo into the layout UNCHANGED"
- "This photo is a LOCKED LAYER -- you cannot modify the pixels"
- "Design the background, text, and borders AROUND this locked photo"
- Remove any language that implies the model should "generate" photography

#### 3. Add a story-specific scaling instruction (edge function)

For story (9:16) format with a reference, add explicit instructions:
- "The reference photo should be placed as a LARGE element within the vertical frame"
- "NEVER regenerate or redraw the person -- if the photo doesn't fit the vertical layout, add dark padding above and below"
- "It is acceptable for the photo to occupy only 50-60% of the vertical canvas, with headline text above and CTA below"

#### 4. Simplify the prompt when reference is present (edge function)

The prompt is very long (~240 lines of text). Long prompts can cause the model to lose focus on key instructions. When a reference photo is present, strip out the photography generation instructions and cinematic photography language entirely -- those only apply to no-reference mode. This reduces prompt length and eliminates conflicting signals.

### What stays the same
- All headline pools, palette logic, retry logic unchanged
- Gold gradient and dark background styling unchanged
- Layout structure (3 layouts) stays the same, just the reference photo language gets sharper
- Non-reference mode (no photo uploaded) stays the same

### Technical Details

The key insight is that putting the text prompt first (before the image) combined with much stronger "do not redraw" language should improve compliance. The model currently sees the image first with no context, which may cause it to treat the image as a "style reference" rather than a "photo to include."
