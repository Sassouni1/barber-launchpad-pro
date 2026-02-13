

## Palette Choice + Website Images Gallery

### What Changes

**1. Frontend (`src/pages/Marketing.tsx`)**

- Add a `paletteChoice` state: `'gold' | 'website'`, defaulting to `'gold'`
- After scraping succeeds, show a new **"Brand Assets"** card between the input card and the generated variations:
  - **Palette selector**: Two clickable cards side by side
    - "Premium Gold/Dark" -- gold swatch (#D4AF37) + dark swatch (#1A1A1A), selected by default
    - "Website Colors" -- shows extracted color swatches; greyed out if none found
  - **Website Images**: Horizontal scrollable row of all scraped images (up to 6), each with a download button on hover
- Remove `realImages` from the `Variation` interface -- website photos only live in the top gallery
- Remove the `CarouselSlide` type distinction and badges ("Website Photo" / "AI Generated") since carousels are now AI-only
- Each variation carousel shows only 3 AI-generated images
- Pass `palette: paletteChoice` in the edge function request body
- Simplify `getSlides` to only return AI images
- Simplify dot indicators (no green/gold color distinction)

**2. Edge Function (`supabase/functions/generate-marketing-image/index.ts`)**

- Accept a new `palette` parameter from the request body
- If `palette === 'gold'` (or missing): hardcode gold/dark palette regardless of extracted colors
  - Primary accent: #D4AF37
  - Background: #1A1A1A
  - Text: #FFFFFF
- If `palette === 'website'`: use extracted brand colors as currently implemented
- Remove the `image_url` injection block (lines that add real photos as multimodal input) -- the AI will generate original cinematic imagery via text-only prompts, which produced the better results
- Keep the 3 layout variations (Split, Full-bleed, Framed) rotating by index

### UI Layout

```text
+------------------------------------------+
| [URL Input]         [Analyze & Generate] |
| Content Type / Tone selectors            |
+------------------------------------------+

+------------------------------------------+
| BRAND ASSETS                             |
|                                          |
| Color Palette:                           |
| [x] Premium Gold/Dark  [ ] Website Colors|
|     #D4AF37 #1A1A1A        #3B82F6 #111  |
|                                          |
| Website Images:                          |
| [img1] [img2] [img3] [img4] [img5]      |
|  (horizontal scrollable row, download)   |
+------------------------------------------+

+------------------------------------------+
| Variation 1                        [Copy]|
| +------------------------------------+   |
| |    < [AI Image Carousel] >         |   |
| +------------------------------------+   |
| |         o   o   o                  |   |
| Caption text...                          |
+------------------------------------------+
```

### Files Modified

- `src/pages/Marketing.tsx` -- palette picker UI, website images gallery, pass palette to edge function, AI-only carousels
- `supabase/functions/generate-marketing-image/index.ts` -- accept `palette` param, conditionally use gold or website colors, remove image_url injection

