

## Make Anti-Fake-Person Rules More Aggressive

The current rules tell the AI not to generate fake people, but it's still doing it occasionally. The fix: repeat the rule multiple times in different sections, use stronger "failure" language, and add a second self-check pass.

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Strengthen the reference instructions block (lines 134-149)**

Add a bold repeated warning at the end of the existing block:

```
=== ZERO TOLERANCE ===
If your final image contains ANY person who is not pixel-for-pixel from the provided reference photo, your output is a FAILURE. There are no exceptions. No stylized versions. No "similar looking" people. No AI-generated faces. ONLY the exact reference photo pixels.
```

**2. Add Rule 14 to CRITICAL DESIGN RULES (after Rule 13, line 210)**

```
14. ZERO AI-GENERATED PEOPLE: When a reference photo is provided, you are absolutely forbidden from generating, drawing, painting, or synthesizing any human face, head, hair, or body. The reference photo is the ONLY source of human imagery. If you catch yourself generating a person instead of embedding the reference photo, STOP and start over. This rule overrides all other creative decisions.
```

**3. Expand the FINAL VERIFICATION block (lines 214-218)**

Replace the existing 4-check block with a 6-check block that repeats the anti-fake rule with escalating severity:

```
=== FINAL VERIFICATION — DO THIS BEFORE OUTPUTTING ===
1. Does your image contain any human face or body? If YES, is it from the provided reference photo? If you generated a new person, DELETE THEM and redo with the reference photo only.
2. The reference photo is the ONLY source of human imagery allowed. No exceptions. No "inspired by" versions. The actual photo pixels.
3. Is any person cut off at the edges of the image (hair, face)? If YES, reframe with more space around them.
4. Does the reference photo show a before-and-after transformation? If YES, are BOTH sides fully visible? If either side is cropped, scale down and reposition to show the complete transformation.
5. SECOND CHECK: Look at every person in your image one more time. Compare each face to the reference photo. If ANY face does not match the reference EXACTLY, remove it. An AI-generated face is NEVER acceptable.
6. If you failed any check above, DO NOT output the image. Redo it from scratch.
```

### What stays the same
- All layout logic, color logic, retry logic, base64 fetching
- Rules 1-13 (unchanged)
- Headline pools, content stripping, brand name conditionals

