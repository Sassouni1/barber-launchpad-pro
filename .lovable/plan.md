

## Fix: "UNALTERED" Text Appearing on Generated Images

### Problem
The prompt contains many capitalized instruction words like "UNCHANGED", "IMMUTABLE", "LOCKED LAYER", "UNALTERED" that Gemini is rendering as visible text on the image. The model confuses bold instructional language with desired on-image text.

### Solution
Rewrite the reference photo instructions in the edge function to remove all-caps "action words" that the model might render as text. Replace them with softer phrasing that conveys the same constraint without looking like headline copy.

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

1. **Replace all-caps instruction keywords throughout the prompt**:
   - "UNCHANGED" -> "without any modifications"
   - "IMMUTABLE" -> "fixed"  
   - "LOCKED LAYER" -> "provided photo layer"
   - "PASTE" -> "place" or "include"
   - Remove any occurrence of "UNALTERED"
   - Keep all-caps only for words that are meant to appear AS TEXT on the image (like headline examples and CTA text)

2. **Specifically update these sections**:
   - `stopAndReadPreamble` (lines 178-193): Rephrase "LOCKED LAYER", "IMMUTABLE INPUT", "PIXEL FOR PIXEL"
   - `criticalRulesBlock` Rule #2 (line 201): Rephrase "PASTE it UNCHANGED"
   - `referencePhotoBlock` (lines 210-223): Rephrase "LOCKED LAYER", "IMMUTABLE ASSET", "EXACT original pixels"
   - Layout instructions (lines 98-106): Rephrase "PASTE it UNCHANGED", "PASTED as large full-bleed", "exact pixels"
   - Final verification block (lines 263-269): Rephrase "EXACT UNCHANGED pixels"

3. **Add an explicit negative instruction**: "Do NOT render any instructional words as visible text on the image. The only text on the image should be the headline, brand name, and CTA."

### What stays the same
- All headline pools, palette logic, retry logic, layout structure
- The intent of every instruction (preserve the photo exactly) -- just the wording changes
- Non-reference mode prompt unchanged

