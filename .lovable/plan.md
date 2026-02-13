
## Add Hair Protection Rule to Text Placement

### Problem
The current prompt prevents text placement over faces but doesn't forbid text over hair. Since hair is the primary focus of a barbershop/hair system business, placing headlines or text over hair areas obscures the key product—defeating the purpose of the reference photo.

### Solution
Add an explicit "HAIR PROTECTION" rule to the critical design rules section that prevents all text placement over hair areas, similar to the existing face protection rule.

### Technical Change

**File: `supabase/functions/generate-marketing-image/index.ts`** -- Add a hair protection rule (after line 145):

Insert a new rule (rule 11):
```
11. HAIR PROTECTION: Never place text, headlines, or decorative elements over any hair areas. Keep all text placement in safe zones: dark background panels, top/bottom margins, side columns, or areas below the neck/jawline. Hair must always be fully visible and unobstructed to showcase the quality and style.
```

This will be inserted after the existing rule 10 and before the closing of the CRITICAL DESIGN RULES section.

The rule explicitly:
1. Forbids text placement over hair (headlines, brand names, CTAs, decorative elements)
2. Specifies safe zones for text (dark panels, margins, columns, below jawline)
3. Reinforces that hair visibility is critical for the barbershop business model
