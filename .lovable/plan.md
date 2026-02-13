
## Fix: Website Mode Forces Hair System Context Even When Not Selected

### Problem
Three hardcoded references to "barbershop/hair replacement business" exist in both edge functions. When a user analyzes a website (e.g., a restaurant, fitness studio, or general business) without selecting "Hair System" as the category, the AI still frames everything around hair systems because the system prompts literally say "specializing in the hair replacement, hair systems, and barber industry."

### Root Cause
The `businessCategory` variable is used to inject extra context, but the **base system prompts** are hardcoded to hair/barber regardless. So even with no category selected, the AI thinks it's writing for a hair business.

### Solution
Make the base prompts generic when no category (or a non-hair category) is selected. Only mention hair/barber when the user explicitly picks a hair-related category.

### Technical Changes

**File 1: `supabase/functions/generate-marketing/index.ts`**

1. **Line 71** -- Change the system prompt intro from hardcoded hair industry to dynamic:
   - If a category is selected, use a category-appropriate intro (e.g., "specializing in hair system services")
   - If no category, use generic: "You are an expert marketing copywriter. You create compelling, on-brand marketing content that drives engagement and conversions."

2. **Line 83** -- Remove the always-present fallback "If the business is related to hair systems/barber services, lean into that expertise" -- this should only appear when the category context is active.

**File 2: `supabase/functions/generate-marketing-image/index.ts`**

1. **Line 113** -- Photography fallback: Change from "fits a barbershop/hair replacement business" to a dynamic description based on `businessCategory`. If no category, use generic: "fits the brand's industry and style."

2. **Line 117** -- Main prompt intro: Change from "for a barbershop/hair replacement business" to dynamic. If no category, use generic: "for a premium brand."

### Mapping

| businessCategory | Prompt wording |
|---|---|
| `hair-system` | "hair system / non-surgical hair replacement business" |
| `haircut` | "barbershop / men's grooming business" |
| `salon` | "hair salon" |
| `extensions` | "hair extensions business" |
| (empty/none) | Generic -- derive context from the website content only |

This ensures that when someone uses the "Website" feature without picking a category, the AI reads the actual website content and generates relevant marketing -- not hair system content.
