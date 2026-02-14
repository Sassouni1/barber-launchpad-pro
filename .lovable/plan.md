

## Protect Reference Photos from AI Alteration

### Problem
The AI is redrawing/recreating people in reference photos instead of using the actual image. The current instructions say "Apply cinematic color grading" and "Blend the photo naturally" which gives the AI too much creative license to alter or regenerate the subject.

### Solution
Update the reference photo instructions to allow cinematic styling (color grading, filters, lighting adjustments) while strictly forbidding any alteration of the actual person (face, hair, body, features).

### Technical Change

**`supabase/functions/generate-marketing-image/index.ts`** -- Replace the `referenceInstructions` block (lines 100-107):

**Current:**
```
- Incorporate the reference photo prominently — it should be the main visual element
- Apply clean cinematic color grading and balanced professional lighting to the photo
- Overlay the headline text in bold typography ON TOP of or alongside the photo
- The result must look like a professionally designed social media post, NOT a raw photo
- Blend the photo naturally with the background and brand elements
```

**New:**
```
- Display the reference photo as the main visual element. Do NOT redraw, recreate, or generate a new version of the photo.
- Use the EXACT pixels from the provided image for all people/subjects. Do NOT alter faces, hair, skin, body, or any physical features of any person in the photo.
- You MAY apply cinematic color grading, lighting adjustments, filters, and tonal shifts to the photo — but the actual person must remain completely unmodified.
- You may crop or resize the photo to fit the layout.
- Place headline text and design elements AROUND or BESIDE the photo, not covering faces.
- The result must look like a professionally designed social media post, NOT a raw photo.
- Blend the photo naturally with the background and brand elements.
```

This keeps all the cinematic polish (color grading, filters, lighting) while drawing a hard line: never alter the actual person in the image.

