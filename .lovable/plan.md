

## Fix: Prevent AI from Inventing Fake Brand Names

### The Problem
When `brandProfile.title` is empty or missing, the AI sometimes invents filler text like "BARBERSHOP NAME" and puts it on the image. Line 192 already says "do NOT invent or display any brand name" when no title is provided, but the layout instructions on lines 92-94 still reference "brand name" placement (e.g., "Brand name at top in smaller text"), which contradicts the no-name rule.

### The Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Make layout instructions conditional on having an actual brand name (lines 89-95)**

When `brandProfile.title` is empty, remove all "brand name" references from layout descriptions:
- Layout 1 (split): Remove "and brand name" from the text panel description
- Layout 2 (full-bleed): Remove "Brand name at top in smaller text"
- Layout 3 (framed): Remove "Brand name and tagline BELOW the photo"

**2. Add an explicit anti-filler rule to CRITICAL DESIGN RULES (after line 207)**

Add a new rule:
```
12. NEVER invent, fabricate, or use placeholder business names. If no brand name was provided above, do NOT write "BARBERSHOP NAME", "YOUR BRAND", "STUDIO NAME", or ANY made-up name on the image. Leave the brand name area empty or omit it entirely. Only display a brand name if one was explicitly provided.
```

### What stays the same
- All reference photo logic, retry logic, color/font extraction
- The existing line 192 conditional (kept as reinforcement)
- Everything else in the prompt

### File changed
- `supabase/functions/generate-marketing-image/index.ts`

