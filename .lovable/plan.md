

## Update Marketing Image Headlines with Custom Examples

### What's Changing
Replace the generic "reclaim your confidence" style headlines in the image generation prompt with your curated list of 30+ proven headline examples. The AI will randomly pick from these as creative direction instead of defaulting to the same tired phrases.

### Technical Change

**`supabase/functions/generate-marketing-image/index.ts`:**

Update the `hair-system` category context in the prompt's TEXT ON THE IMAGE section to include your full headline bank:

```
HEADLINE STYLE EXAMPLES (use these as creative direction — pick ONE style per image, do NOT reuse across variations):
- "REAL HAIRLINE. REAL CONFIDENCE. ZERO SURGERY."
- "INSTANT DENSITY. UNDETECTABLE FINISH."
- "THINNING TO THICK. IN ONE SESSION."
- "SEAMLESS. CUSTOM. PRECISE."
- "ZERO PATCHY. ZERO OBVIOUS. ZERO COMPROMISE."
- "A HAIRLINE THAT HOLDS UP UNDER LIGHT."
- "BUILT TO BLEND. DESIGNED TO LAST."
- "NO SCARS. NO DOWNTIME. JUST RESULTS."
- "WHEN IT LOOKS THIS NATURAL, NO ONE ASKS."
- "ENGINEERED HAIRLINES. BARBER-FINISHED."
- "FROM RECEDING TO REDEFINED."
- "CLEAN HAIRCUT. FLAWLESS BLEND."
- "PRECISION INSTALLED. PROFESSIONALLY STYLED."
- "THE DIFFERENCE IS IN THE DETAILS."
- "PRECISION HAIR SYSTEMS INSTALLED DAILY"
- "INSTANT RESULTS. SEAMLESS BLEND. ZERO SURGERY."
- "FLAWLESS HAIRLINE, ZERO DETECTION."
- "INSTANT TRANSFORMATION. ZERO COMPROMISE."
- "FRESH LOOK. ZERO SURGERY. SAME-DAY RESULTS."
```

Also update the `generate-marketing` text content function with similar headline direction so the caption copy stays aligned with the image headlines.

Add a prompt rule: "Each of the 3 variations MUST use a completely different headline style from the examples. Never repeat the same phrasing across variations."

### What Stays the Same
- All layout logic, reference photo handling, color/font extraction
- CTA placement rules, face protection rules
- Everything else in the prompt

