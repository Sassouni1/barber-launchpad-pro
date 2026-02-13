

## Fix Brand Photos: Default Selection and Stronger Reference Usage

### Problem
1. `sourceChoice` defaults to `'ai'` so users unknowingly generate AI-only images
2. Even when Brand Photos is selected, the Gemini prompt treats the reference image as "inspiration" rather than requiring it to be prominently featured

### Changes

**File: `src/pages/Marketing.tsx`**
- Change default `sourceChoice` from `'ai'` to `'brand'`

**File: `supabase/functions/generate-marketing-image/index.ts`**
- Rewrite the `referenceInstructions` prompt block when `hasReference` is true
- New prompt will instruct Gemini to use the reference photo as the dominant visual element (background or hero image), NOT generate a completely new scene
- Specifically tell the AI: "The reference photo MUST be the main visual. Use it as the background. Overlay text, brand elements, and decorative accents on top. Do NOT replace or reimagine the photo."

### Technical Details

**Marketing.tsx line 164:**
```
// Before
const [sourceChoice, setSourceChoice] = useState<SourceChoice>('ai');
// After
const [sourceChoice, setSourceChoice] = useState<SourceChoice>('brand');
```

**Edge function prompt change (referenceInstructions when hasReference):**
Replace the current vague "incorporate the reference photo prominently" with explicit instructions:
- "The provided reference photo IS the background of this design. Do not generate new photography."
- "Place the reference image full-bleed or as the dominant element."
- "Apply a dark gradient overlay on top of the photo for text readability."
- "Render the headline text, brand name, and decorative elements ON TOP of the photo."
- "The final output must clearly show the original reference photo, not a reimagined version."

No database or other file changes needed.
