

## Upgrade to High-Quality Image Model

### Problem
Currently using `gemini-2.5-flash-image` -- a lightweight "flash" model designed for speed/cost, not quality. Previously the app used `gemini-3-pro-image-preview` (Google's top-tier image model) which produced much better results.

### Solution
Switch the model to `gemini-3-pro-image-preview` in the edge function. This model is available through the same direct Google AI Studio API, so it works with your API key -- no gateway needed.

### Quality Comparison

| Feature | gemini-2.5-flash-image | gemini-3-pro-image-preview |
|---|---|---|
| Text rendering | Basic | Excellent |
| Design composition | Simple | Professional |
| Prompt following | Moderate | Strong |
| Speed | Fast (~5-10s) | Slower (~15-30s) |
| Overall quality | Budget | Premium |

### Change

**File: `supabase/functions/generate-marketing-image/index.ts`** (line 154)

Replace the model identifier:
```text
gemini-2.5-flash-image
```
With:
```text
gemini-3-pro-image-preview
```

This is a single-line change. The API request/response format is identical across all Gemini image models, so nothing else needs to change.

### Trade-off
Images will take slightly longer to generate (~15-30s vs ~5-10s per image) but quality will be dramatically better -- matching what you had before.
