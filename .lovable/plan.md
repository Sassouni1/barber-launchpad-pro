

## Fix Marketing Image Quality Issues

### Problems Identified

1. **Headline truncation**: The edge function passes `variationContent.substring(0, 120)` as the image headline. Captions are 150-300 words long -- they should never be used as image text. The result is cut-off sentences like "it's about how you feel when you..."

2. **Category slug displayed as text**: "hair-system" appears as raw text on the image because the prompt includes it directly.

3. **Reference photo cropping**: The split layout instruction tells the AI to use 40/60 split, which crops before/after photos poorly, losing the transformation effect.

### Solution

**Edge Function: `supabase/functions/generate-marketing-image/index.ts`**

1. **Generate a short headline separately from the caption**: Instead of substring-ing the long caption, add a `variationHeadline` or `variationTitle` field. Use the variation's `title` (which is already short, e.g., "Emotional Appeal") as a fallback, or instruct the AI in the prompt to create its own 5-8 word headline based on the content theme.

2. **Replace raw category slug**: Convert "hair-system" to "Hair System" (proper formatting) or remove it from the image text entirely -- the category context should inform the design, not appear as visible text.

3. **Update prompt to generate its own headline**: Instead of forcing the truncated caption onto the image, tell the AI: "Create a bold, punchy headline (5-8 words max) inspired by this theme: [variationContent]". This lets the model compose proper image text.

4. **Fix reference photo cropping rule**: Add a prompt instruction that before/after transformation photos must show BOTH sides. Update the split layout to say "if the reference photo contains a before/after comparison, show the full photo without cropping."

### Frontend: `src/pages/Marketing.tsx`

- Pass `variationTitle` (the short label like "Emotional Appeal" or "Promotional Push") alongside `variationContent` to the edge function, so the function has a short text option available.

### Specific Changes

**Edge function prompt changes:**
- Replace: `Headline: "${variationContent.substring(0, 120)}"` 
- With: `Theme/mood of the post: "${variationContent.substring(0, 200)}" -- Create your OWN bold headline of 5-8 words max based on this theme. Do NOT copy this text directly onto the image.`
- Replace: `Brand: "${brandProfile.title || ''}"` keep as is but remove any raw category slug from appearing
- Add to layout instructions: "If the reference photo shows a before-and-after transformation, you MUST display the FULL photo without cropping either side."
- Add rule: "Never display category labels, slugs, or metadata as visible text on the image."

**Frontend changes:**
- Pass `variationTitle` in the request body alongside `variationContent`
- Format `businessCategory` properly (e.g., "hair-system" to "Hair System") before sending

