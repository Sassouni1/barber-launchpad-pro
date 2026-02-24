

## Fix: Better Error Handling for Website Analysis Failures

### Problem
When Firecrawl can't scrape a website (blocked by the site, down, invalid URL, etc.), the edge function returns a 500 status with a long technical error message. The client sees "Edge function returned a non-2xx status" instead of a helpful message. This happens on both mobile and desktop.

The logs show the exact error: `SCRAPE_ALL_ENGINES_FAILED` -- meaning the website is blocking automated scraping.

### Solution

**File: `supabase/functions/scrape-website/index.ts`**

1. When Firecrawl returns an error, return a **200 status with `success: false`** instead of forwarding the 500 status. This prevents the Supabase client from throwing a generic "non-2xx" error and lets the client read the actual error message.

2. Map common Firecrawl error codes to **user-friendly messages**:
   - `SCRAPE_ALL_ENGINES_FAILED` -> "This website couldn't be analyzed -- it may be blocking automated access. Try a different URL or enter your brand info manually."
   - Generic/other errors -> "Failed to analyze this website. Please check the URL and try again."

**File: `src/pages/Marketing.tsx`**

3. Improve the error toast to show a shorter, cleaner message instead of the raw error string. No structural changes needed since the edge function fix will deliver proper error messages through `data.error`.

### Technical Details

In the edge function, change the error response block (around line 60):

Before:
```
return new Response(
  JSON.stringify({ success: false, error: data.error || '...' }),
  { status: response.status, ... }  // forwards 500
);
```

After:
```
// Map to friendly message
let userMessage = 'Failed to analyze this website.';
if (data.code === 'SCRAPE_ALL_ENGINES_FAILED') {
  userMessage = "This website couldn't be analyzed — it may be blocking automated access. Try a different URL.";
}

return new Response(
  JSON.stringify({ success: false, error: userMessage }),
  { status: 200, ... }  // return 200 so client can read the message
);
```

### What stays the same
- All scraping logic and Firecrawl integration
- Image extraction and brand profile building
- Client-side Marketing page structure
- All other edge functions

