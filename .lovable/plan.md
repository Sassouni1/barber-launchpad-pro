

## Make All 4 Variations AI-Generated Marketing Posts

### The Problem

Brand image variations (1 and 2) currently try to crop raw website photos via Canvas, which fails due to CORS and produces unpolished results. The user wants all 4 variations to have the same professional quality: overlaid text, cinematic lighting, and the "marketing post" look.

### The Solution

All 4 variations will be AI-generated using `generate-marketing-image`. The brand variations will pass scraped website photos as multimodal reference images so the AI incorporates the real brand imagery into polished compositions. The AI variations will generate purely from text prompts (no reference photos).

### How It Works

| # | Name | AI Input | Size |
|---|------|----------|------|
| 1 | Brand Images (Square) | Text prompt + scraped photo as reference | 1080x1080 |
| 2 | Brand Images (Stories) | Text prompt + scraped photo as reference | 1080x1920 |
| 3 | AI Generated (Square) | Text prompt only | 1080x1080 |
| 4 | AI Generated (Stories) | Text prompt only | 1080x1920 |

Total AI calls: 12 (3 per variation)

### Edge Function Changes

**`supabase/functions/generate-marketing-image/index.ts`**:

- Accept a new `referenceImageUrl` parameter (optional)
- When provided, add the image as a multimodal `image_url` content part alongside the text prompt
- Add instructions telling the AI to incorporate the reference photo into a polished marketing composition with text overlays, cinematic grading, and brand elements
- When not provided (AI variations), use the existing text-only prompt for original cinematic imagery
- Keep existing `palette` and `size` params working as-is

### Frontend Changes

**`src/pages/Marketing.tsx`**:

- Remove the `cropImage` function entirely -- no more client-side Canvas cropping
- Update `buildVariations` for brand types: instead of cropping, fire 3 AI calls per brand variation, passing each scraped image URL as `referenceImageUrl`
- If fewer than 3 scraped images exist, only generate that many slides (no null placeholders)
- Keep `resizeImage` for final sizing of AI output (works fine since those are data URLs)
- Fix `imagesLoading` logic: track a counter of completed calls instead of checking index

### Prompt Strategy for Brand Variations

The AI prompt will include instructions like:

"Use the provided reference photo as the hero image in your composition. Apply cinematic color grading, overlay the headline text in bold typography, and integrate the brand colors. The result should look like a professionally designed social media post, not a raw photo."

This ensures brand photos get the same polished treatment as pure AI images but retain the actual brand imagery.

### Files Modified

- `supabase/functions/generate-marketing-image/index.ts` -- accept `referenceImageUrl`, build multimodal message when present
- `src/pages/Marketing.tsx` -- remove `cropImage`, change brand variations to use AI generation with reference images

