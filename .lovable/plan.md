

## Fix: Retry on 503/Timeout Errors (Not Just 429)

### The Problem
The edge function only retries when it gets a 429 (rate limit) error. When Google returns a 503 ("Deadline expired") — which is a temporary timeout — the function gives up immediately and returns a failure. This is why you get 2 out of 3 images.

### The Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

**Expand the retry loop (lines 231-245) to also retry on 503 errors:**

Currently the loop breaks on anything that isn't a 429. Change it to also retry on 503 (and 500) errors since these are transient Google-side failures.

```
for (let attempt = 0; attempt < maxRetries; attempt++) {
  if (attempt > 0) {
    console.log(`Retry attempt ${attempt + 1} after delay...`);
    await new Promise(r => setTimeout(r, retryDelays[attempt]));
  }

  response = await fetch(googleUrl, { ... });

  // Retry on rate limit OR transient server errors
  if (response.status === 429 || response.status === 503 || response.status === 500) {
    console.warn(`Got ${response.status} on attempt ${attempt + 1}, will retry...`);
    continue;
  }

  break; // Success or non-retryable error
}
```

### What stays the same
- Everything else: prompts, reference photo logic, layouts, headlines, frontend batching
- The cycling of 1 reference image across all 3 slots already works correctly

### File changed
- `supabase/functions/generate-marketing-image/index.ts`

