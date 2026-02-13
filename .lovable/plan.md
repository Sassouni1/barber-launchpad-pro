

## Fix: Send Reference Images as Base64 to Guarantee AI Sees Them

### Root Cause
The reference image is sent as a URL (`image_url.url`). If the AI gateway can't fetch that URL (e.g., CORS, auth headers, timing), Gemini never actually sees the photo and just generates from scratch. This explains the inconsistency -- sometimes it works, sometimes it doesn't.

### Fix
Convert the reference image to base64 on the client side before sending it to the edge function. This guarantees the image data is embedded directly in the request, so Gemini always has access to it.

### Changes

**File: `src/pages/Marketing.tsx`**
- Add a helper function `urlToBase64(url: string): Promise<string>` that fetches the image and converts it to a base64 data URI using canvas
- In the `generateSlot` call for brand mode, convert `realImages[i]` to base64 before passing it as `referenceImageUrl`
- This ensures the edge function always receives actual image data, not just a link that might fail

**File: `supabase/functions/generate-marketing-image/index.ts`**
- Detect if `referenceImageUrl` is already a base64 data URI (starts with `data:image/`)
- If it's a regular URL, fetch it and convert to base64 inside the function as a fallback
- Pass the base64 data URI directly in the `image_url.url` field to the AI gateway -- this is supported by the OpenAI-compatible API format
- Keep the strict prompt instructions already in place

### Why This Works
- Base64 images are embedded directly in the API request body -- no external fetching needed
- The AI model is guaranteed to receive the actual pixel data
- Combined with the strict "DO NOT reimagine" prompt, this should reliably produce overlays on the real photos
- No visual quality loss -- still AI-composed with professional typography, just guaranteed to use the actual photo
