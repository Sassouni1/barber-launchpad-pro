

## Fix: Broken Edge Function (referenceAttached is not defined)

### The Problem

The last code change that restructured the prompt accidentally removed the critical section that:
1. Initializes the `parts` array
2. Fetches the reference image as base64
3. Sets the `referenceAttached` variable

This causes a `referenceAttached is not defined` error on every image generation attempt, which is why you see "No images available."

### The Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

#### 1. Replace all references to `referenceAttached` with `hasReference`

The variable `hasReference` is already correctly defined on line 86 as `!!referenceImageUrl`. The undefined `referenceAttached` on lines 139, 151, 167, and 215 must all be changed to `hasReference`.

#### 2. Restore the `parts` array initialization and reference image fetching

Before the prompt is constructed (around line 137), add back the missing code that:
- Initializes `const parts: any[] = []`
- If `hasReference` is true, fetches the reference image using `fetchImageAsBase64()` (the function already exists at line 6)
- Pushes the image inline data into `parts` as `{ inlineData: { data: base64, mimeType } }`
- If the reference image is a data URL (starts with `data:`), parses the base64 directly instead of fetching
- Wraps the fetch in a try/catch that returns a 502 error if it fails (to prevent falling back to AI generation)

#### 3. Remove the misleading comment on line 87

Delete the comment "Note: referenceAttached is set later after actual fetch" since we are using `hasReference` directly.

### What stays the same
- All prompt text, rules, layouts, verification steps
- The `fetchImageAsBase64` helper function
- All retry logic and response handling

### Result
Image generation will work again immediately after this fix is deployed.

