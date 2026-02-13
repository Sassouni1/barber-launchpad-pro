

## Smart Image Analysis for Better Marketing Posts

### Problem
Right now, every scraped image gets used in both Square (1080x1080) and Story (1080x1920) variations blindly. When a scraped image is a "before and after" photo (wide/square aspect ratio showing two people side by side), forcing it into a Story format stretches or crops it badly. These images need intelligent routing to the right template.

Additionally, the `resizeImage` function is force-stretching AI output into exact dimensions, causing distortion (the zoomed-in issue you saw).

### Solution
Add an **image analysis step** using AI vision. Before generating marketing posts, each scraped image gets analyzed by a new edge function that determines:
- Is it a before/after photo?
- What is its aspect ratio (landscape, portrait, square)?
- What composition style would work best?

Based on the analysis, each image gets routed to the template size where it will look best, and the AI prompt is customized accordingly.

### New Edge Function: `analyze-brand-images`

A lightweight edge function that sends each scraped image URL to Gemini Flash (fast and cheap) and asks it to classify the image:

| Field | Values | Purpose |
|-------|--------|---------|
| `isBeforeAfter` | true/false | Detects side-by-side transformation photos |
| `orientation` | landscape, portrait, square | Natural aspect ratio of the content |
| `bestFit` | story, square, both | Which template size suits the image best |
| `description` | string | Short description for better AI prompting |

**Before/after images** get routed to Story templates (tall format = text on top, photo on bottom, no stretching). **Portrait images** also go to Story. **Square/landscape images** go to Square templates.

### Changes to `generate-marketing-image`

- Accept a new `imageAnalysis` parameter with the classification data
- When a before/after image is detected, use a specialized prompt: "Place the before-and-after reference photo in the lower half. Bold headline text fills the upper half. Do NOT crop or zoom the photo -- show it in full."
- When orientation is known, adjust composition instructions accordingly
- Remove the hardcoded `#D4AF37` literal from text prompts (currently leaking as visible text in generated images -- see your screenshot showing "#D4AF37" in the output)

### Changes to `Marketing.tsx`

1. **Remove `resizeImage` entirely** -- stop force-stretching AI output. Use raw AI URLs directly with CSS `object-cover`.

2. **Add image analysis step** after scraping, before generating:
   - Call `analyze-brand-images` with all scraped image URLs
   - Show a brief "Analyzing images..." loading state
   - Store analysis results alongside the brand profile

3. **Smart routing in `buildVariations`**:
   - Instead of blindly sending every image to both square and story, check each image's `bestFit`
   - Images classified as `bestFit: 'story'` (before/afters, portraits) only generate Story variations
   - Images classified as `bestFit: 'square'` (landscapes, wide shots) only generate Square variations  
   - Images classified as `bestFit: 'both'` generate in both sizes
   - Pass the `imageAnalysis` data to the generation call so the prompt adapts

4. **Fix the hex code leak**: The current prompt has `${accentColor}` being interpolated into text the AI renders. When using gold palette, "#D4AF37" literally appears in the generated image text. This will be fixed by keeping color instructions in a separate design section, away from the headline text.

### Flow

```text
Scrape Website
      |
      v
Analyze Each Image (Gemini Flash vision)
      |
      v
Classify: before/after? orientation? bestFit?
      |
      v
Route to Best Template
   /        \
Square     Story
(wide,     (before/after,
landscape)  portrait)
      \        /
       v      v
  AI Generation with adapted prompts
```

### Files Modified

- **New**: `supabase/functions/analyze-brand-images/index.ts` -- vision-based image classifier
- **Modified**: `supabase/functions/generate-marketing-image/index.ts` -- accept `imageAnalysis`, adapt prompts for before/after, fix hex leak
- **Modified**: `src/pages/Marketing.tsx` -- remove `resizeImage`, add analysis step, smart routing logic

