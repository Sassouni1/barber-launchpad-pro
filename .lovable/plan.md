

## Fix Head Cropping + Fake People + Restore Gold Accents

### The Problem

The image you just showed has the top of the person's hair completely chopped off at the top edge. Despite having Rules 9, 13, 14, 15 and verification steps about this, it keeps happening. And we're still occasionally getting fake AI-generated people instead of the real reference photo.

**Root cause**: The prompt is structured as:
1. Aspect ratio
2. Brand colors
3. Layout
4. Reference photo instructions (anti-fake rules)
5. Text/headline
6. Design rules (including head visibility)
7. Verification

The AI model reads top-down and commits to a composition early. By the time it reaches the head visibility and anti-fake rules (buried at rules 9, 14, 15), it's already decided on framing. The most critical rules are in the weakest position.

### The Fix

**File: `supabase/functions/generate-marketing-image/index.ts`**

#### 1. Restructure the entire prompt so the 3 most critical rules come FIRST

Reorder the prompt to:

```
1. STOP AND READ preamble (if reference attached): "The image above is a REAL photograph. Your ONLY job is to place this EXACT photo into a designed marketing layout."
2. FULL HEAD VISIBILITY rule (current Rule 15) - moved to position #1
3. ANTI-FAKE-PERSON rule (current Rule 14) - moved to position #2
4. BEFORE-AND-AFTER rule (current Rule 13) - moved to position #3
5. Then: Aspect ratio
6. Then: Brand colors
7. Then: Layout
8. Then: Text/headline
9. Then: Remaining design rules (1-12)
10. Then: Gold accent rule (new Rule 16)
11. Then: Verification
```

#### 2. Add "STOP AND READ" preamble right after the reference image inline data

When a reference photo is attached, the first text the model sees (right after the image bytes) will be:

> "STOP AND READ: The image above is a REAL photograph of a REAL person. You are NOT generating a person. You are designing a marketing layout AROUND this exact photo. The person's ENTIRE head, ALL hair, and COMPLETE face must be visible with breathing room on every side. COMMON FAILURE: The AI crops the top of the head or generates a 'similar looking' person. Both are IMMEDIATE FAILURES."

#### 3. Add gold accent as a numbered rule

Add Rule 16:
> "GOLD ACCENTS: Every image MUST include at least one visible gold (#D4AF37) design element -- a thin gold outer border/frame, a gold dotted-line divider, gold text on key headline words, or a gold CTA button outline. Gold is the signature accent of this brand's visual identity."

#### 4. Add negative example to anti-fake rule

Append to the anti-fake rule:
> "COMMON FAILURE MODE: The AI often generates a 'similar looking' person with slightly different features, different lighting, or a cleaner background. This is STILL a fake person. The ONLY acceptable human imagery is the literal pixel data from the reference photo."

### What stays the same
- All rule content (just reordered)
- All 3 layout styles (split, full-bleed, editorial)
- Headline pools, retry logic, color palette logic
- Verification steps (with reordered numbering)
- Reference image fetching and base64 encoding

