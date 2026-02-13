

## Fix: Ensure Real Reference Photos Appear in All Generated Images

### The Real Problem

Gemini 3 Pro Image is a **generative** model. When you give it a reference photo and say "use this exact person," it generates a **new image inspired by** the reference — it does not composite the actual photo. This is why 2 out of 3 images show AI-generated people instead of the real person. No prompt wording will fix this reliably because it's a fundamental limitation of the model.

### Solution: Two-Phase Image Generation

Instead of asking Gemini to handle both the design AND the person's photo, split the work:

**Phase 1 (Gemini):** Generate a marketing graphic with an **explicit empty photo placeholder zone** — a clearly marked rectangular area with a solid color or pattern, NO generated person. The rest of the design (headline, CTA, brand name, decorative elements, dark background) is generated normally.

**Phase 2 (Client-side Canvas):** After Gemini returns the image, use an HTML Canvas on the frontend to composite the real reference photo into the placeholder zone. This guarantees the real person appears every time.

### Technical Changes

**File 1: `supabase/functions/generate-marketing-image/index.ts`**

When a reference image is provided, change the prompt strategy:
- Remove the reference photo from the Gemini request entirely (don't send it as inline data)
- Instead, tell Gemini to create a marketing design with a **clearly defined empty photo zone** filled with a solid placeholder color (e.g., `#FF00FF` magenta — easy to detect)
- The photo zone dimensions depend on the layout:
  - Split: right 75% of the image is the placeholder
  - Full-bleed: center 65% vertical band is the placeholder
  - Framed: centered rectangle with border is the placeholder
- All text, headlines, CTAs go in the remaining zones as before
- Return both the generated image AND the placeholder zone coordinates in the response

**File 2: `src/pages/Marketing.tsx`**

Add a canvas compositing step after receiving the generated image:
- Load the Gemini-generated image onto a canvas
- Detect the placeholder zone (either by known coordinates returned from the API, or by scanning for the magenta fill)
- Draw the real reference photo into that zone, scaled to fit (cover mode, centered)
- Export the composited canvas as the final image
- This runs entirely client-side, is fast, and guarantees the real photo appears

### Response Format Change

The edge function response will include:
```json
{
  "success": true,
  "imageUrl": "data:image/...",
  "photoZone": { "x": 270, "y": 0, "width": 810, "height": 1080 }
}
```

When `photoZone` is present, the frontend composites the reference photo into that region.

### Why This Works
- Gemini only generates the **design elements** (text, backgrounds, borders, decorative accents) — things it's good at
- The real person's photo is placed programmatically — guaranteeing exact likeness every time
- Text placement rules still apply to the design-only image, and since there's no person in the Gemini output, text can never land on a face or hair
- Each of the 3 images gets a different layout but the same real photo composited in

### Implementation Order
1. Update edge function to generate design-only images with placeholder zones when reference is provided
2. Add photo zone coordinates to the response
3. Add client-side canvas compositing in Marketing.tsx
4. Test with the AG Celebrities Salon reference photos
5. Redeploy edge function

### Fallback
If no reference image is provided, the current behavior continues unchanged — Gemini generates the full image including AI photography.

