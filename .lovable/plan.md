

## Palette Choice, Website Images Gallery, and 4-Format Variations

### Overview

Restructure the Marketing page into a clear two-phase layout: a **Brand Assets** section (palette picker + scraped image gallery) shown after scraping, followed by **4 fixed variation types** -- each with its own image format and source (real vs AI).

### Brand Assets Section (New)

Appears between the URL input card and the generated variations after scraping:

- **Palette Selector**: Two clickable cards side by side
  - "Premium Gold/Dark" -- gold (#D4AF37) + dark (#1A1A1A) swatches, selected by default
  - "Website Colors" -- shows extracted color swatches from Firecrawl; greyed out if none found
- **Website Images Gallery**: Horizontal scrollable row of all scraped images (up to 6) with download buttons on hover
- New state: `paletteChoice: 'gold' | 'website'`

### 4 Variation Types

Instead of 3 text variations each with mixed carousels, generate **4 distinct variation cards**, each with a specific format:

| # | Name | Source | Size | Aspect |
|---|------|--------|------|--------|
| 1 | Brand Images (Square) | Real website photos | 1080x1080 | 1:1 |
| 2 | Brand Images (Stories) | Real website photos | 1080x1920 | 9:16 vertical |
| 3 | AI Generated (Square) | AI-generated | 1080x1080 | 1:1 |
| 4 | AI Generated (Stories) | AI-generated | 1080x1920 | 9:16 vertical |

- Variations 1-2 use the scraped website photos, resized/cropped to the target dimensions via Canvas
- Variations 3-4 are AI-generated with different size prompts
- Each variation has a 3-slide carousel with prev/next arrows and dot indicators
- Each slide has a download button on hover

### Edge Function Changes

**`supabase/functions/generate-marketing-image/index.ts`**:

- Accept new `palette` param (`'gold'` | `'website'`):
  - `gold`: hardcode gold/dark palette (the proven aesthetic)
  - `website`: use extracted brand colors
- Accept new `size` param (`'square'` | `'story'`):
  - `square`: prompt says "1:1 square image"
  - `story`: prompt says "9:16 vertical portrait image (1080x1920)"
- Remove the `image_url` injection block (lines 102-121) -- real photos are shown separately; AI generates original cinematic imagery via text-only prompts
- Keep the 3 layout variations rotating by `index`

### Frontend Changes

**`src/pages/Marketing.tsx`**:

- Add `paletteChoice` state defaulting to `'gold'`
- After scraping, render the Brand Assets card (palette picker + image gallery)
- Update `Variation` interface:
  ```
  type: 'brand-square' | 'brand-story' | 'ai-square' | 'ai-story'
  images: (string | null)[]
  imagesLoading: boolean
  ```
- For brand variations (1-2): take scraped images and resize them to 1080x1080 or 1080x1920 using the existing Canvas `resizeImage` function (update it to accept any width/height)
- For AI variations (3-4): fire 3 parallel calls each to `generate-marketing-image` with `palette` and `size` params
- Total AI calls: 6 (3 square + 3 story)
- Update `ImageCarousel` to handle different aspect ratios (`aspect-square` vs `aspect-[9/16]`)
- Remove the `CarouselSlide` type distinction and badges -- each variation card already declares its type in the title
- Remove `realImages` from variation interface -- brand images are handled by variation type, not mixed

### Image Processing

- Brand square (1080x1080): center-crop the scraped image to fill a square
- Brand story (1080x1920): center-crop the scraped image to fill a 9:16 vertical frame
- AI square: `resizeImage(dataUrl, 1080, 1080)` (existing logic)
- AI story: `resizeImage(dataUrl, 1080, 1920)` (new size)

### Files Modified

- `src/pages/Marketing.tsx` -- palette picker, website gallery, 4 variation types, updated carousel
- `supabase/functions/generate-marketing-image/index.ts` -- accept `palette` + `size` params, remove image_url injection, conditional color logic

