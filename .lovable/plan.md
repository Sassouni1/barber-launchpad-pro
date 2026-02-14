

## Fix: Real Photos Instead of AI Faces

### The Real Problem
Reference photos ARE being sent to Gemini correctly. The issue is fundamental: image generation models don't composite photos -- they generate everything from scratch. Even with strong prompts saying "preserve exact likeness," Gemini creates new AI-approximated people. This will keep happening no matter how we word the prompt.

### The Solution: Hybrid Compositing
Generate the design layout with a **placeholder zone** (solid color block where the photo should go), then **programmatically overlay the real reference photo** onto that zone using canvas on the client side.

### How It Works

1. **Prompt Change** (edge function): For "brand" variations with a reference image, the prompt will instruct the AI to leave a clearly marked **solid-colored placeholder rectangle** (e.g., bright magenta `#FF00FF`) where the photo should appear -- no AI-generated person, just a flat color block. The rest of the design (text, layout, colors, decorative elements) is generated normally by AI.

2. **Remove the reference photo from the API call**: When using the hybrid approach, we no longer send the reference image to Gemini (since it's not using it properly anyway). This also speeds up the request.

3. **Client-side compositing** (Marketing.tsx): After receiving the AI-generated layout image, detect the magenta placeholder region and overlay the real reference photo onto it using an HTML canvas:
   - Load the AI layout image onto a canvas
   - Scan for the magenta placeholder zone (find bounding box of `#FF00FF` pixels)
   - Draw the reference photo scaled to fit that zone
   - Export the composited result as the final image

4. **Fallback**: If placeholder detection fails (the AI didn't create a clean magenta zone), fall back to the current behavior (show the AI-generated image as-is).

### Technical Details

**File: `supabase/functions/generate-marketing-image/index.ts`**
- Add a new flag `useHybridCompositing` when `hasReference` is true
- Change the prompt for hybrid mode: replace "insert the reference photo" instructions with "place a solid magenta (#FF00FF) rectangle as a photo placeholder"
- Stop sending the reference image as `inlineData` in hybrid mode
- Return `{ success: true, imageUrl, hybrid: true }` so the client knows to composite

**File: `src/pages/Marketing.tsx`**
- Add a `compositeImage(layoutUrl: string, refPhotoUrl: string)` function that:
  1. Draws the AI layout on a canvas
  2. Scans pixels to find the magenta placeholder bounding box
  3. Loads and draws the reference photo into that bounding box
  4. Returns the final composited data URL
- In `generateSlot`, when the response has `hybrid: true`, call `compositeImage` before saving

### What This Means for You
- "Brand Images" will show the ACTUAL person from your reference photos -- not AI approximations
- "AI Generated" images continue working as before (fully AI-generated)
- The design quality (text, layout, colors) stays the same since AI still handles that part
- If the compositing ever fails, you still get the AI layout as a fallback

