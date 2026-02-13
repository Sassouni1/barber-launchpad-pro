

## Simplify Image Generation: Choose Format Type

### What Changes

Instead of generating all 4 variation types (12 images) at once, users will pick a single format -- **Square** or **Story** -- and only generate images for that format. This cuts generation to 3-6 images max per run.

### UI Changes

**Format Selector** (added between Tone selector and the Analyze button area):
- Two clickable cards side by side, similar to the palette selector style
- **Square (1:1)** -- shows a small square icon outline with "1080 x 1080" dimension text
- **Story (9:16)** -- shows a tall rectangle icon outline with "1080 x 1920" dimension text
- Selected state uses the same ring/highlight treatment as the palette selector
- Default selection: Square

**Results Section**:
- Instead of a 2x2 grid of 4 cards, show only 2 cards in a row:
  - "Brand Images (Square)" + "AI Generated (Square)" -- if Square selected
  - "Brand Images (Stories)" + "AI Generated (Stories)" -- if Story selected
- Each card still has up to 3 carousel slides

### Technical Details

**New state**: `formatChoice: 'square' | 'story'` (default `'square'`)

**`buildVariations` changes**:
- Only create 2 variation cards instead of 4, based on `formatChoice`
- If `formatChoice === 'square'`: create `brand-square` and `ai-square` only
- If `formatChoice === 'story'`: create `brand-story` and `ai-story` only
- This reduces AI calls from 12 to 6 (or fewer if limited brand images)

**Format selector component** (inline in Marketing.tsx):
- Two styled buttons with SVG/icon dimension indicators
- Square icon: a small square outline with "1080 x 1080" below
- Story icon: a tall narrow rectangle outline with "1080 x 1920" below
- Placed in the input card, below the Content Type / Tone row

**No edge function changes** -- the `size` parameter already supports `'square'` and `'story'`.

