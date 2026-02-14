

## Fix: Website Scraper Not Extracting Images

### Problem
When analyzing `www.thebaberlaunch.com`, the scraper returns zero images (`"images": []`). This means:
1. No images show up in the "Images" section of the brand profile
2. All image generation falls back to pure AI (no reference photos), producing fake people
3. The "Brand Images" mode has no reference photos to work with

The root cause is in the `scrape-website` edge function. It only extracts images from:
- Markdown `![alt](url)` patterns
- `og:image` metadata
- Firecrawl branding data (logo, ogImage)

Many modern websites (especially those built with frameworks like Wix, Squarespace, or custom SPAs) render images via CSS backgrounds, lazy-loading, or JavaScript -- none of which appear in Firecrawl's markdown output.

### Solution
Two changes to the `scrape-website` edge function:

1. **Request HTML format from Firecrawl** in addition to markdown, and extract `<img src="...">` tags from the raw HTML. This catches images that don't appear in the markdown conversion.

2. **Use the screenshot as a fallback image** -- if no images are found at all, and a screenshot was captured, include the screenshot URL in the images array so the user has at least one reference image.

3. **Extract from Firecrawl's `links` data** -- check if any returned links point to image files (`.jpg`, `.png`, `.webp`).

### Technical Changes

**`supabase/functions/scrape-website/index.ts`:**

- Add `'html'` to the Firecrawl `formats` array so we also get raw HTML
- After the markdown regex, add an HTML `<img>` tag regex to extract `src` attributes from `<img>` tags in the HTML response
- Add `srcset` parsing to catch responsive images
- Filter for reasonable image URLs (skip tiny icons, data URIs, SVGs, tracking pixels)
- If after all extraction we still have zero images but have a screenshot, push the screenshot URL into the images array as a last resort
- Keep the existing 6-image cap to avoid overwhelming the generation pipeline

This should dramatically improve image extraction for sites where the markdown format strips out visual content.
