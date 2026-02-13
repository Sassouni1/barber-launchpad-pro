

## Fix "HAIR SYSTEM" Text and Photo Cropping

### Problem 1: Category Name Displayed as Brand Name

When no website URL is provided, the frontend creates a minimal brand profile with `title` set to the business category (e.g., "Hair System"). The edge function prompt then says `Brand name: "Hair System"`, causing the AI to render "HAIR SYSTEM" prominently on the image.

**Fix (Frontend - `src/pages/Marketing.tsx`):**
- When creating the fallback brand profile without a URL, set `title` to an empty string (or omit it) instead of the category name
- The category context is already passed separately via `businessCategory` -- it does not need to double as the brand name

### Problem 2: Reference Photo Still Getting Cropped

The split layout allocates only 60% width to the photo, which crops before/after images. While we added a text instruction, the 40/60 split constraint overrides it.

**Fix (Edge Function - `supabase/functions/generate-marketing-image/index.ts`):**
- When a reference image is provided, adjust the split layout to give more space to the photo (e.g., 25/75 or let the AI decide)
- Alternatively, for the split layout specifically, instruct: "If a reference photo is provided, use it at full width across the right panel without any cropping -- expand the photo area as needed to show the complete image"

### Technical Changes

**`src/pages/Marketing.tsx`:**
- Change the fallback brand profile from `{ title: formattedCategory, ... }` to `{ title: '', ... }` so no fake brand name is rendered on the image

**`supabase/functions/generate-marketing-image/index.ts`:**
- Update the prompt: if `brandProfile.title` is empty, omit the "Brand name" line from the prompt entirely
- Adjust split layout instruction to prioritize showing the full reference photo: change "left 40%" to "left 25%" when a reference image is present, giving the photo 75% of the space
