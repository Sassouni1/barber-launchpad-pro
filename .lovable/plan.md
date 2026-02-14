
## Fix: Stop Generating Fake Images When Reference Fetch Fails

### Problem
When in "Brand Images" mode, some images come out as AI-generated fakes because:

1. The reference image fetch silently fails (line 156-158) -- it catches the error, logs a warning, and continues without the photo
2. But `hasReference` is still `true`, so the prompt tells the AI "use the reference photo" even though no image data was actually attached
3. The AI then invents/redraws a fake person to satisfy the prompt

### Fix

**`supabase/functions/generate-marketing-image/index.ts`** -- Two changes:

1. **Hard fail when reference fetch fails**: Replace the `console.warn` + continue with a **502 error response**. If a reference image was requested but can't be fetched, the function should return an error instead of silently generating a fake image.

2. **Track whether the image was actually attached**: Add a boolean (`referenceAttached`) that only becomes `true` when the image data is successfully added to the `parts` array. Use this instead of `hasReference` when deciding which prompt instructions to include. This way, if the fetch fails for any reason, the prompt won't mislead the AI into thinking there's a reference photo.

### What this means for the user
- When in "Brand Images" mode, if a reference photo can't be loaded, that slot will show as "failed" instead of showing a fake AI image
- No more surprise fake people mixed in with real brand photos
- The user can retry or upload different reference images
