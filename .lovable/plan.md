

## Fix: Switch Image Generation to Direct Google AI Studio API

### Root Cause
The edge function calls `google/gemini-3-pro-image-preview` through the **Lovable AI gateway** (`ai.gateway.lovable.dev`). This gateway adds significant overhead and queuing, resulting in 2-10 minute response times per image. The model itself can generate images in ~10-30 seconds when called directly.

### Solution
Switch the edge function to call the **Google AI Studio API directly** using the `GOOGLE_AI_STUDIO_KEY` secret that is already configured. This bypasses the gateway overhead entirely.

### Changes (single file)

**File: `supabase/functions/generate-marketing-image/index.ts`**

1. Replace the Lovable gateway call with a direct call to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
2. Use `GOOGLE_AI_STUDIO_KEY` instead of `LOVABLE_API_KEY`
3. Restructure the request body to match Google's native API format:
   - Use `inlineData` for reference images (base64) instead of `image_url`
   - Add `responseModalities: ["TEXT", "IMAGE"]` in `generationConfig`
   - Parse the response from Google's native format (`candidates[0].content.parts`) instead of OpenAI-compatible format
4. Extract generated image from `inlineData.data` (base64) in the response parts and return it as a data URL

### Expected Performance
- **Before**: 2-10 minutes per image (Lovable gateway)
- **After**: 10-30 seconds per image (direct Google API)
- With Parallel-2 batching of 6 images: ~1-2 minutes total instead of 12-60 minutes

### Reference Image Handling
- When `referenceImageUrl` is provided, fetch the image, convert to base64, and send as `inlineData` in the request
- When no reference image, send text-only prompt

### No frontend changes needed
The edge function response format (`{ success: true, imageUrl }`) stays the same -- the `imageUrl` will be a base64 data URL instead of a hosted URL, which works identically in `<img>` tags.

