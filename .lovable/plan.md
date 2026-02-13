

## Fix Word-Breaking in Headlines

### Problem
Headlines are breaking mid-word (e.g., "CONFI-DENCE") because the prompt demands massive text (30% of image area) without any instruction about what to do when words don't fit.

### Solution
Simple prompt rule addition -- no layout changes needed:

**`supabase/functions/generate-marketing-image/index.ts`:**

Update design rule #1 from:
> "The headline typography must be MASSIVE -- taking up at least 30% of the image area."

To:
> "The headline typography must be large and impactful. If a word does not fit on a single line, reduce the font size until it does. Never hyphenate or break a word across two lines."

This tells the AI to prioritize readable, unbroken words over raw text size.

