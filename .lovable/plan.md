

## Fix Image Dimensions for Marketing Generator

The current implementation only describes the desired dimensions in the text prompt, but the Gemini image model ignores pixel-exact sizing instructions. The generated images are coming out at the model's default resolution (likely 1024x1024), not the requested 1080x1080 or 1080x1920.

### The Problem

The `google/gemini-2.5-flash-image` model via the chat completions endpoint does not support a `size` parameter. Putting "1080x1920" in the prompt text is a hint at best -- the model produces images at its own default dimensions.

### The Fix

Use the higher-quality image model `google/gemini-3-pro-image-preview` which produces better results and supports aspect ratio guidance through prompting more reliably. Additionally, post-process the generated images using an HTML Canvas in the edge function to resize them to the exact target dimensions before returning.

**Edge function changes (`supabase/functions/generate-marketing-image/index.ts`):**

1. After receiving the base64 image from the AI model, decode it
2. Use a server-side image resize approach: since Deno edge functions don't have Canvas, we can't resize server-side easily. Instead, handle resizing on the frontend.

**Frontend changes (`src/pages/Marketing.tsx`):**

1. When a base64 image is received, draw it onto an off-screen HTML Canvas at the exact target dimensions (1080x1080 for square, 1080x1920 for story)
2. Export the canvas as a new base64 PNG at the correct resolution
3. Use this resized image for display and download

This guarantees the downloaded images are exactly 1080x1080 or 1080x1920 regardless of what the model outputs.

### Technical Details

**Modified: `src/pages/Marketing.tsx`**
- Add a `resizeImage(dataUrl: string, width: number, height: number): Promise<string>` utility function
- Uses an off-screen `<canvas>` element to draw the source image and export at exact dimensions
- Called after each image generation resolves, before storing in state
- Story images resized to 1080x1920, square images to 1080x1080

**Modified: `supabase/functions/generate-marketing-image/index.ts`**
- Improve the prompt to more strongly emphasize the aspect ratio (portrait 9:16 vs square 1:1) so the model generates images closer to the correct proportions before resizing
- Consider switching to `google/gemini-3-pro-image-preview` for better quality output

### Resize Function

```text
resizeImage(base64DataUrl, targetWidth, targetHeight)
  -> Create Image element, load base64
  -> Create canvas at targetWidth x targetHeight
  -> Draw image scaled to fill canvas
  -> Export canvas as PNG data URL
  -> Return exact-dimension image
```

This ensures every downloaded image is pixel-perfect at 1080x1080 or 1080x1920.

