

## Add AI Image Generation to Marketing Generator

Generate visual marketing assets (like Pomelli) -- story-sized images (1080x1920) with text overlaid, plus square posts (1080x1080). Each generation produces 3 variations, each with both sizes.

### How It Works

1. After text variations are generated (existing flow), the system automatically generates images for each variation
2. Uses the Gemini image model (`google/gemini-2.5-flash-image`) to create branded marketing visuals with text on the image
3. Each variation gets two image sizes: Story (1080x1920) and Square Post (1080x1080)
4. Images load progressively -- text appears first, then images fill in

### What Changes

**New Edge Function: `supabase/functions/generate-marketing-image/index.ts`**
- Accepts brand profile, variation text/title, content type, tone, and size (story or square)
- Builds a detailed prompt describing a professional marketing graphic with the caption text overlaid on the image
- Calls `google/gemini-2.5-flash-image` via the Lovable AI chat completions endpoint with `modalities: ["image", "text"]`
- Returns the base64 image data
- Handles 429/402 errors

**Updated: `src/pages/Marketing.tsx`**
- `Variation` interface gains `storyImageUrl`, `squareImageUrl`, and `imagesLoading` fields
- After text variations arrive, fires off parallel image generation calls (2 per variation = 6 total)
- Each variation card shows a tabbed view: "Story (9:16)" and "Square (1:1)"
- Images displayed in proper aspect ratio containers
- Download button for each image
- Skeleton loaders while images generate

**Updated: `supabase/config.toml`**
- Register `generate-marketing-image` with `verify_jwt = false`

### UI Layout per Variation Card

```text
+--------------------------------------------------+
|  VARIATION TITLE                    [Copy] [DL]   |
+--------------------------------------------------+
|  [Story 9:16]  [Square 1:1]   <-- tab toggle     |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |     Generated image with text overlay      |  |
|  |     (skeleton while loading)               |  |
|  |                                            |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
|  Caption text here for copying...                 |
+--------------------------------------------------+
```

### Technical Details

**Image generation prompt strategy:**
The prompt will instruct the model to create a visually striking marketing graphic that includes:
- The brand name prominently displayed
- Key marketing text from the variation overlaid on the image
- Visual style matching the selected tone (luxury = elegant/dark, bold = vibrant colors, etc.)
- Relevant imagery for the hair systems / barber industry
- No watermarks or placeholder text

**Files to create:**
- `supabase/functions/generate-marketing-image/index.ts`

**Files to modify:**
- `src/pages/Marketing.tsx` -- add image state, parallel image calls, tabbed image display, download buttons
- `supabase/config.toml` -- register new function

**Image generation is done per-image** (not batched) so they can load progressively and failures are isolated. The frontend fires 6 parallel requests (3 variations x 2 sizes) and updates each card as its images resolve.
