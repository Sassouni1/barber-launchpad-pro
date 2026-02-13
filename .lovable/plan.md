

## Fix: Reference Photos Being Reimagined + Website Content Too Short

### Root Cause Analysis

**1. Reference photos are being reimagined, not used literally**
The logs confirm all 3 images had `hasReference: true` and no fetch failures -- so the reference photo WAS sent to Gemini every time. The problem is fundamental: Gemini 3 Pro Image is a **generation** model, not a compositing tool. When you give it a photo and say "use this," it generates a new image *inspired by* the reference rather than placing the actual photo into a design. One out of three happened to look close enough; the other two diverged into AI-generated people.

**2. Website content truncated to 500 characters**
Line 149 sends only `brandProfile.content?.substring(0, 500)` to the image AI. For a salon website, 500 chars barely covers the page title and first paragraph -- it misses the actual services, pricing, specialties, etc. The AI then falls back to generic content.

### Proposed Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

**Change 1: Increase website content from 500 to 2000 characters (line 149)**
Give the image AI enough context to actually understand the brand's offerings, themes, and services.

**Change 2: Add explicit 3-step headline extraction (line 151)**
Replace the current headline strategy with a structured approach:
- Step 1: Identify the brand's industry and top 3 services/offerings from the website content
- Step 2: Create a headline that directly references one of those identified services or themes
- Step 3: Use actual terms found on the website (e.g., "balayage specialists" or "keratin treatments") rather than generic phrases

**Change 3: Strengthen reference photo instructions to emphasize exact likeness (lines 104-111)**
Add explicit language that the person is a REAL person whose exact appearance (skin tone, facial features, hair style, hair color, body type, clothing) MUST be preserved identically. Add: "Do NOT generate an AI approximation or a 'similar-looking' person."

**Change 4: Add a hard fail when reference image fetch fails (lines 187-189)**
Currently the code silently falls back to pure AI generation when the reference image fetch fails. Change this to return a 502 error so the frontend knows to retry, rather than generating a fake person with a prompt that still says "use the reference photo."

**Change 5: Add debug logging for website content (after line 176)**
Log the first 200 characters of `brandProfile.content` so we can verify the scrape data is actually flowing into the image function.

### Important Caveat
Gemini image generation has an inherent limitation: it generates new images rather than compositing existing photos into designs. The stronger instructions will improve consistency, but the model may still produce variations that don't perfectly match the reference. The hard fail on fetch errors and stronger likeness language will reduce the worst cases (completely different people).

### Files Changed
- `supabase/functions/generate-marketing-image/index.ts` (5 edits)
- Redeploy edge function

