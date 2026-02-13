

## Fix: AI-Generated Images Should Match the Actual Brand, Not Default to "Barbershop"

### Problem

The `generate-marketing-image` edge function has **hardcoded** references to "barbershop/hair replacement business" in the prompt. When generating "AI Generated" images (no reference photo), the photography instructions say:

> "Generate original cinematic photography that fits a barbershop/hair replacement business."

This means no matter what website you scrape, the AI always generates barber-themed images.

### Solution

Update the edge function prompt to use the **actual brand description and content** from the scraped website instead of hardcoded industry references.

### Technical Details

**File: `supabase/functions/generate-marketing-image/index.ts`**

1. **Remove hardcoded "barbershop/hair replacement" from the main prompt** (line 93):
   - Change from: `"...creating a premium marketing image for a barbershop/hair replacement business"`
   - Change to: `"...creating a premium marketing image for: ${brandProfile.title || 'a business'}. Business description: ${(brandProfile.description || brandProfile.content || '').substring(0, 300)}"`

2. **Update the no-reference photography instructions** (lines 88-91):
   - Change from: `"Generate original cinematic photography that fits a barbershop/hair replacement business."`
   - Change to: `"Generate original cinematic photography that fits this specific business: ${brandProfile.title}. ${(brandProfile.description || '').substring(0, 200)}. The imagery should directly represent what this business does and sells."`

3. **Keep the reference-image instructions unchanged** -- those already work well since they use the actual brand photo.

### What This Fixes

- AI-generated images will reflect the actual website content (e.g., a dental practice gets dental imagery, a restaurant gets food imagery)
- Brand name and description are injected dynamically into the prompt
- Content is truncated to avoid exceeding token limits

