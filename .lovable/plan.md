

## Soften Background Requirement from "True Black" to "Dark/Premium"

### What's changing

The current prompt is too aggressive — it demands pure black (#0A0A0A) and says anything lighter is a "FAILURE." The background should be dark and premium but not always jet black. Deep charcoals, dark moody tones, and rich dark colors should all be acceptable.

### Changes (1 file)

**File: `supabase/functions/generate-marketing-image/index.ts`**

#### 1. Soften the `brandColorBlock` background line (line 74)

Change from:
> "Background: TRUE BLACK (#0A0A0A to #0D0D0D) — as dark as possible, like black velvet or luxury card stock. Must be indistinguishable from pure black (#000000)."

To:
> "Background: Dark and premium — deep black (#0D0D0D), rich charcoal (#1A1A1A), or other dark moody tones. The background should feel luxurious and cinematic. Avoid bright, light, or medium-toned backgrounds."

#### 2. Soften Rule #2 (line 220)

Change from:
> "Background MUST be TRUE BLACK (#0A0A0A to #0D0D0D) — as dark as possible, like black velvet or luxury card stock. The background should be indistinguishable from pure black (#000000) in most lighting conditions. #1A1A1A is TOO LIGHT — do NOT use it. Never use charcoal, navy, brown, gray, or any medium-toned backgrounds."

To:
> "Background should be DARK and PREMIUM — ranging from deep black (#0D0D0D) to rich charcoal (#1A1A1A). Dark moody tones are welcome. The overall feel should be luxurious and cinematic. Avoid any light, bright, or medium-toned backgrounds."

#### 3. Soften Rule #13 (line 231)

Change the phrase "The overall color palette must read as TRUE BLACK AND METALLIC GOLD" to "The overall color palette must read as DARK AND METALLIC GOLD" — removing the insistence on pure black specifically.

### What stays the same
- Metallic gold gradient description unchanged
- All layout logic, headline pools, retry logic, verification steps unchanged
- Website palette logic unchanged

