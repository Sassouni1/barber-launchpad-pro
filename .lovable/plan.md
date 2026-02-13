

## Add Image Type Selector (Brand / AI / Both)

Currently, generation always creates both "Brand Images" and "AI Generated" cards. This adds a selector so you can pick which type you want.

### Changes (single file: `src/pages/Marketing.tsx`)

**1. New state variable**
- Add `imageMode` state with options: `'both'` | `'brand'` | `'ai'` (default: `'both'`)

**2. Image Mode selector UI**
- Add a 3-option toggle in the settings card (next to Format selector), styled the same way as the format buttons
- Options:
  - **Brand Images** -- uses your uploaded/scraped reference photos as the base with AI text overlays
  - **AI Generated** -- fully AI-generated images with no reference photo
  - **Both** -- generates both sets (current behavior)

**3. Update `buildVariations` logic**
- When `imageMode === 'brand'`: only create the brand variation card and only queue brand jobs
- When `imageMode === 'ai'`: only create the AI variation card and only queue AI jobs  
- When `imageMode === 'both'`: current behavior (both cards)
- This also reduces total generation time when only one type is selected (3 images instead of 6)

**4. Update results grid**
- When only one type is selected, show it full-width instead of in a 2-column grid

### No backend changes needed

