

## Show Real + AI Images in a Carousel

Each variation will display 6 images total: 3 real photos pulled from the website and 3 AI-generated graphics. Instead of showing them as separate stacked cards, they'll be presented in a swipeable carousel/slider within each variation card.

### Changes

**1. Frontend (`src/pages/Marketing.tsx`)**

- Update the `Variation` interface to hold arrays of images instead of single story/square URLs:
  ```
  realImages: string[]         // 3 images scraped from the website
  aiImages: string[]           // 3 AI-generated images
  aiImagesLoading: boolean     // loading state for AI batch
  ```
- After scraping, pull up to 3 real images from `brandProfile.images` and store them on each variation
- Generate 3 AI images per variation (fire off 3 parallel calls instead of 2 story/square calls)
- Replace the Story/Square tabs with an Embla carousel that cycles through all 6 images (real first, then AI), with:
  - Dot indicators showing position
  - A small label badge on each slide ("From Website" vs "AI Generated")
  - Download button on hover for each image
  - Left/right arrow navigation

**2. Image Generation (`supabase/functions/generate-marketing-image/index.ts`)**

- Remove the `size` parameter distinction (story vs square) -- instead accept an `index` (0, 1, 2) to vary the layout
- Generate all images as square (1:1 at 1080x1080) for consistency in the carousel
- Use the existing layout variation logic (index 0 = split, index 1 = full-bleed, index 2 = framed) so each of the 3 AI images looks different

**3. No changes to scrape function** -- it already extracts up to 6 images

### UI Layout Per Variation Card

```text
+------------------------------------------+
| Variation Title                    [Copy] |
|                                          |
|  +------------------------------------+  |
|  |                                    |  |
|  |     < [Image Carousel Slide] >     |  |
|  |       "From Website" badge         |  |
|  |                                    |  |
|  +------------------------------------+  |
|  |       o  o  o  o  o  o             |  |
|  +------------------------------------+  |
|                                          |
|  Caption text here...                    |
+------------------------------------------+
```

### Technical Details

- Uses `embla-carousel-react` (already installed) for the slider
- Real images are displayed as-is (direct URLs from the website)
- AI images go through the existing `resizeImage` canvas function to enforce 1080x1080
- 3 AI image generation calls fire in parallel per variation (so 9 total for 3 variations)
- Each slide shows a small pill badge: "Website Photo" (green) or "AI Generated" (gold)
- Carousel has prev/next arrow buttons and dot indicators

### Files Modified

- `src/pages/Marketing.tsx` -- new data model, carousel UI, parallel 3x AI image generation
- `supabase/functions/generate-marketing-image/index.ts` -- accept `index` instead of `size`, generate square only, vary layout by index

