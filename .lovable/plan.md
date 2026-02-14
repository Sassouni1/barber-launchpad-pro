
## Soften Contrast and Lighten Image Effects

### Problem
The generated marketing images are described as "too intense" due to high contrast, heavy dark overlays, and "dramatic" lighting instructions in the AI prompt. The user wants the same professional look but with "lighter opacity" on these filters and effects to make them feel less heavy.

### Solution
I will update the `generate-marketing-image` edge function to use more subtle lighting and overlay instructions while maintaining the premium aesthetic. This involves moving away from "dramatic" and "heavy" keywords towards "natural", "balanced", and "sophisticated" descriptors.

### Technical Changes
**Edge Function (`supabase/functions/generate-marketing-image/index.ts`):**
- **Layout 1 (Full-bleed)**: Change the overlay description from "heavy dark gradient overlay (70% opacity)" to "subtle dark gradient overlay (40% opacity)".
- **Photography Instructions**: Replace "dramatic lighting" with "natural, high-end studio lighting" to avoid harsh shadows and overly intense contrast.
- **Reference Photo Instructions**: Update "Apply cinematic color grading and dramatic lighting" to "Apply clean cinematic color grading and balanced professional lighting".
- **Design Rule 2**: Soften the strict "MUST be DARK" language. It will now encourage "rich, sophisticated tones" while explicitly stating to "maintain a premium feel without being overly heavy or flatly dark".
- **Blend Instruction**: Update the blending instruction to be "natural" rather than forcing it into a "dark background".
- **Layout Descriptions**: Update layouts to use "sophisticated dark" instead of "dark solid" or "dark background" to signal a more nuanced use of color to the AI.

These changes should result in images that still look premium and expensive but feel "lighter" and more accessible.

<lov-mermaid>
graph TD
    A[Current Intense Style] -->|Update Prompt| B[New Softer Style]
    B --> C[Subtle Overlays 40% vs 70%]
    B --> D[Balanced Studio Lighting]
    B --> E[Rich/Sophisticated Tones]
    B --> F[Natural Blending]
    C & D & E & F --> G[Premium but Accessible Result]
</lov-mermaid>
