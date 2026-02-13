

## Face-Aware Image Composition

### Problem
Generated marketing images sometimes cut off faces or place text directly over people's faces, making them look unprofessional.

### Solution
Add explicit face-protection rules to the AI prompt in the `generate-marketing-image` edge function. Since Gemini 3 Pro is a multimodal model that understands spatial composition, we can instruct it to respect face regions.

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

Add a new `FACE PROTECTION RULES` section to the prompt (inserted into the `CRITICAL DESIGN RULES` list):

- **Never crop or cut off faces** -- if a person is in the image, their full face (forehead to chin) must be fully visible within the frame
- **Never place text over faces** -- headlines, brand names, and decorative elements must be positioned in areas that do not overlap with any person's face
- **Safe text zones**: place text in the top 20%, bottom 20%, or on a solid-color panel/overlay area that does not cover a face
- **When using reference photos with people**: preserve the subject's face completely; apply gradient overlays and text only to non-face regions (e.g., dark gradient from the edges inward, leaving the face clear)
- **For split layouts**: ensure the photo side shows the full face uncropped; text stays on the solid panel side

These rules get added as items 8-10 in the existing `CRITICAL DESIGN RULES` numbered list, keeping everything in one prompt block. No new API calls, no cost increase -- just better prompt instructions.

### No other files change
This is a prompt-only update in the single edge function file.

