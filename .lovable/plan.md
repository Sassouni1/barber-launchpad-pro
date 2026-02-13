

## Fix: Upgrade Image Generation Model for Better Quality

### Root Cause
The switch to direct Google API used `gemini-2.0-flash-exp-image-generation` -- an older, experimental model that produces significantly lower quality images compared to the `gemini-3-pro-image-preview` model that was used before through the Lovable gateway.

### Solution
Update the model identifier in the edge function to `gemini-2.5-flash-image`, which is Google's current recommended image generation model. This was part of the original approved plan but was never applied.

### Change

**File: `supabase/functions/generate-marketing-image/index.ts`** (line 153)

Replace:
```text
gemini-2.0-flash-exp-image-generation
```
With:
```text
gemini-2.5-flash-image
```

This single-line change keeps the direct API approach (fast ~10-30s per image) while using a much better model for image quality.

### Why this helps
- `gemini-2.0-flash-exp-image-generation`: Experimental, lower quality, inconsistent outputs
- `gemini-2.5-flash-image`: Current stable model, significantly better image quality, same API format

No other changes needed -- the request/response format is identical across Gemini image models.

