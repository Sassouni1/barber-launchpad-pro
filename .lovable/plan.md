

## Force AI to Use Reference Photo (Not Generate New Faces)

### Problem
When a reference photo is provided, the AI sometimes ignores it entirely and generates its own before-and-after imagery with fake faces. The current prompt says "incorporate the reference photo prominently" but this is too soft -- the model treats it as a suggestion rather than a requirement.

### Solution
Strengthen the reference photo instructions in the image generation prompt to make it unmistakably clear that the provided photo must appear in the output as-is, not be replaced with AI-generated imagery.

### Technical Change

**`supabase/functions/generate-marketing-image/index.ts`**

Update the `REFERENCE PHOTO INSTRUCTIONS` block from the current soft language to strict enforcement:

Current:
```
You have been given a reference photo from the brand's website. You MUST use this photo as the hero/featured image in your composition.
- Incorporate the reference photo prominently...
- Apply cinematic color grading and dramatic lighting to the photo
- Overlay the headline text in bold typography ON TOP of or alongside the photo
- The result must look like a professionally designed social media post, NOT a raw photo
- Blend the photo seamlessly with the dark background and brand elements
```

New:
```
You have been given a reference photo. This is the ONLY photo that should appear in the final image.
- You MUST use this EXACT photo as the main visual. Do NOT generate, replace, or recreate any part of it with AI-generated imagery.
- Do NOT generate new faces or people. The reference photo contains the real subject -- use it exactly as provided.
- You may apply minor color grading to match the dark theme, but the photo content must remain unchanged.
- Place headline text and brand elements around or overlaid on the photo using gradients, but never obscure the subject.
- The result must look like a professionally designed social media post featuring this specific photo.
```

This makes three things explicit that were previously ambiguous:
1. Do NOT generate new faces/people
2. Use the photo exactly as provided
3. The reference photo is the ONLY visual allowed

