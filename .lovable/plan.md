

## Fix: Stop Silent Fallback When Reference Image Fetch Fails

### Root Cause

The pattern "2 work, 1 doesn't" is caused by the edge function's silent error handling at line 147-149. Here's what happens:

1. All 3 brand image requests send a `referenceImageUrl` to the edge function
2. Each request independently fetches that URL to convert it to base64
3. The first 2 requests (running concurrently) succeed
4. By the 3rd request, the origin server (e.g., the brand's website CDN) throttles or blocks the repeated download, causing a timeout or 403
5. The `catch` block on line 148 silently swallows this error: `console.warn('Failed to fetch reference image, proceeding without it:', e)`
6. The model then generates with text-only, producing a "pure AI" image

The function literally finds the image (requests 1-2 work) then "forgets" it (request 3 silently fails).

### Solution: Two changes

**1. Edge function: Fail loudly instead of silently (main fix)**

When a `referenceImageUrl` is provided but can't be fetched, return an error response instead of proceeding without it. This lets the frontend know something went wrong.

**2. Edge function: Cache the base64 across requests (prevents the root cause)**

Since the same reference image is often used for all 3 brand slots, fetch it once and pass the base64 data directly from the frontend instead of having each edge function invocation re-fetch the same URL independently. This eliminates the repeated downloads that trigger rate limiting.

### Technical Details

**File: `supabase/functions/generate-marketing-image/index.ts`**

Change the catch block (lines 147-149) from silently proceeding to returning an error:

```
// BEFORE (silent fallback):
} catch (e) {
  console.warn('Failed to fetch reference image, proceeding without it:', e);
}

// AFTER (fail loudly):
} catch (e) {
  console.error('Failed to fetch reference image:', e);
  return new Response(
    JSON.stringify({ success: false, error: 'Could not fetch reference image. The image host may be blocking repeated requests.' }),
    { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Also accept an optional `referenceImageBase64` + `referenceImageMimeType` parameter so the frontend can pass pre-fetched image data, avoiding repeated downloads entirely.

**File: `src/pages/Marketing.tsx`**

Pre-fetch each unique reference image URL once (convert to base64 on the client side), then pass the base64 data directly to the edge function for all slots using that image. This eliminates the repeated server-side fetches that cause the 3rd image to fail.

```
// Before generating, pre-fetch unique reference images
const uniqueUrls = [...new Set(realImages)];
const imageCache = new Map();
for (const url of uniqueUrls) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  // Convert to base64 and cache
  imageCache.set(url, { base64, mimeType });
}

// Then pass cached data to each generateSlot call
```

### Why This Fixes It

- The 3rd image no longer fails silently -- if something goes wrong, the user sees an error
- Pre-fetching eliminates repeated downloads of the same image, so CDN rate-limiting can't cause the issue
- Each edge function call receives the image data directly instead of re-downloading it

