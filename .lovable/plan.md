

## Fix: Switch from Old Gold to True Gold (#FFD700)

### The Problem

The prompt currently uses `#D4AF37` everywhere for gold — this is "old gold," a muted brownish-yellow. The vibrant, eye-catching gold from earlier images was likely `#FFD700` (true gold), which is brighter and reads as actual gold against a black background.

### The Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

Replace ALL instances of `#D4AF37` with `#FFD700` throughout the file. There are approximately 25 occurrences across:

1. **Color variable assignments** (lines 56-66): `primaryColor`, `secondaryColor`, `accentColor` defaults
2. **Design Rule #3** (line 214): Gold text color specification
3. **Design Rule #13** (line 224): Gold accents specification

Additionally, update Rule #13's description to clarify: "Use TRUE GOLD (#FFD700) — bright, rich, and vibrant like real gold metal, NOT muted or brownish."

### What stays the same
- All rules, layouts, verification steps, retry logic
- Black background constraints
- White-and-gold alternating headline pattern
- Everything else in the prompt structure

