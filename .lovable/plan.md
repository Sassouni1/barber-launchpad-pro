

## Extract Brand Colors from Website and Use in Image Generation

Currently the scrape only pulls markdown text and links — it completely ignores the website's visual identity. The image generator then falls back to generic tone-based color palettes that have nothing to do with the actual brand. This is why the results look off.

### The Fix: Two Changes

**1. Scrape function extracts branding (`supabase/functions/scrape-website/index.ts`)**

Add `'branding'` to the Firecrawl formats array. This tells Firecrawl to extract the site's actual colors (primary, secondary, accent, background, text), fonts, and logo URL. The returned `brandProfile` will include a new `branding` object with all of this data.

Change:
```text
formats: ['markdown', 'links']
```
to:
```text
formats: ['markdown', 'links', 'branding']
```

Then include the branding data in the returned profile:
```text
brandProfile = {
  title, description, content, sourceUrl,
  branding: {
    colors: { primary: "#FF6B35", secondary: "#004E89", ... },
    fonts: [{ family: "Inter" }, ...],
    logo: "https://..."
  }
}
```

**2. Image generator uses the real brand colors (`supabase/functions/generate-marketing-image/index.ts`)**

When building the prompt, inject the actual extracted colors and fonts instead of generic descriptions. The prompt will say things like:

```text
Brand colors (use these EXACTLY):
- Primary: #FF6B35
- Secondary: #004E89
- Background: #1A1A1A
- Text: #FFFFFF

Brand fonts: Inter, Roboto Mono
```

This gives the AI model concrete hex values to work with instead of vague instructions like "use professional colors."

Also upgrade the model from `google/gemini-2.5-flash-image` to `google/gemini-3-pro-image-preview` for better visual quality and more reliable color adherence.

**3. Update BrandProfile interface and pass-through (`src/pages/Marketing.tsx`)**

Add `branding` to the `BrandProfile` TypeScript interface so it flows through from scrape to image generation without being dropped.

### Files Modified

- `supabase/functions/scrape-website/index.ts` — add `'branding'` format, include branding data in response
- `supabase/functions/generate-marketing-image/index.ts` — read `brandProfile.branding.colors` and inject hex values into prompt; upgrade model to `gemini-3-pro-image-preview`; rewrite prompt with reference-image-inspired art direction (dark backgrounds, bold typography, decorative elements) combined with real brand colors
- `src/pages/Marketing.tsx` — update `BrandProfile` interface to include optional `branding` field

### What This Achieves

Instead of "make it look professional" the AI now gets "use #D4AF37 as accent color, #1A1A1A as background, Inter font family" — pulled directly from the client's actual website. The images will match the brand identity automatically.

