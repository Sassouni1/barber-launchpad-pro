
## Fix: Website Content Not Driving Headlines + Text Over People

### Current State
The recent diff shows that `businessCategory` was already made dynamic in the photography instructions and business descriptions (lines 113-128), BUT:

1. **Frontend never passes `businessCategory`** (line 268-279 in Marketing.tsx) — the body sent to `generate-marketing-image` doesn't include it
2. **Edge function doesn't destructure `businessCategory`** (line 29 in generate-marketing-image/index.ts) — it's missing from the destructuring
3. **Hardcoded headline examples** (line 141) still contain "Zero Surgery" and "Same-Day Installs" which override the dynamic logic
4. **No instruction to mine website content for themes** — line 139 says "inspired by this theme" but doesn't tell AI to extract actual themes/services from the website content itself
5. **No explicit "use empty space" rule** — only negative rules (don't place over faces/hair) without a positive instruction to prioritize empty zones

### Technical Changes

**File 1: `src/pages/Marketing.tsx`** (line 268-279)
- Add `businessCategory` to the request body so the edge function receives it

**File 2: `supabase/functions/generate-marketing-image/index.ts`** (multiple locations)

1. **Line 29** — Destructure `businessCategory` from request:
   ```typescript
   const { brandProfile, variationTitle, variationContent, contentType, tone, index, palette, size, referenceImageUrl, businessCategory } = await req.json();
   ```

2. **Line 139** — Update headline instruction to mine website content for themes AND services:
   Replace: `"Theme/mood of the post: \"${variationContent.substring(0, 200)}\"..."`
   
   With explicit content mining and theme extraction:
   ```
   Theme/mood of the post: "${variationContent.substring(0, 200)}"
   
   WEBSITE CONTENT CONTEXT: "${brandProfile.content?.substring(0, 500) || ''}"
   
   Headline Strategy: Analyze BOTH the generated theme AND the website content above. Extract key themes, services, or offerings mentioned on the website. Create a bold, punchy headline (5-8 words max) that reflects ONE of these actual themes or services. Do NOT default to generic hair-system messaging unless the website content explicitly mentions hair services.
   ```

3. **Line 141** — Replace hardcoded hair-system headline examples with dynamic ones based on `businessCategory`:
   ```typescript
   const headlineExamples = businessCategory ? {
     'hair-system': '"Fresh Look. Zero Surgery.", "Same-Day Installs"',
     'haircut': '"Sharp Cuts. Clean Lines.", "Walk-Ins Welcome"',
     'salon': '"Your Best Hair Day.", "Color That Turns Heads"',
     'extensions': '"Length You\'ll Love.", "Seamless Blends"',
   }[businessCategory] : '"See The Difference.", "Book Today", "Your Best Look Yet"';
   ```
   
   Then insert into prompt: `HEADLINE STYLE — rotate between these approaches: results-driven (${headlineExamples}), ...`

4. **Line 146** — Add TEXT PLACEMENT PRIORITY rule before all other critical design rules:
   ```
   TEXT PLACEMENT PRIORITY: Before placing ANY text, scan the image and identify the largest empty areas (solid-color walls, ceilings, dark backgrounds, open negative space with no people). ALL headlines, brand names, CTAs, and decorative elements MUST be positioned in these empty zones. If a person occupies one side of the frame and empty space occupies the other, place 100% of the text on the empty side. Never place text over any part of a person — face, hair, body, or clothing.
   ```

### Implementation Order
1. Update frontend to pass `businessCategory`
2. Update edge function destructuring to accept `businessCategory`
3. Create dynamic headline examples mapping
4. Update headline instruction to reference website content and extract themes
5. Add TEXT PLACEMENT PRIORITY rule at the top of critical design rules
6. Redeploy `generate-marketing-image` edge function

### Expected Behavior
- When analyzing a restaurant website with no category selected → headlines will be based on actual restaurant content/themes, not hair systems
- When analyzing a salon website with "salon" category → salon-specific headline examples
- Text will be placed in clearly empty areas (backgrounds, margins, negative space) instead of over people's faces/hair
