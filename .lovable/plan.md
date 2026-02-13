
## Add Image Upload & Remove Functionality to Brand Assets

### What You're Getting

Three new features in the Brand Assets section (lines 399-488), all triggered after analyzing a website:

1. **Upload your own images** - Add a "+" button in the Website Images gallery that lets users upload custom photos
2. **Remove unwanted photos** - Add an "X" button on each image thumbnail to hide it from the gallery and AI generation
3. **Unified image pool** - All images (scraped + uploaded, minus removed) feed into the brand variation AI generation

### Technical Approach

**State Management** (in main component):
- Add `uploadedImages: string[]` - stores data URLs from file uploads (no server needed)
- Add `removedImages: Set<string>` - tracks URLs the user dismissed
- Create `allBrandImages` computed value that merges and filters: `[scrapedImages, uploadedImages] - removedImages`

**Gallery UI Changes**:
- Add a "+" upload tile at the end of the image row (96x96, dashed border, centered Plus icon)
- Add a hidden file input (`<input type="file" multiple accept="image/*" />`) that triggers on tile click
- Add an X button overlay (top-left) on each thumbnail that removes it from `removedImages`
- Keep existing Download button (bottom-right)

**AI Integration**:
- Update `buildVariations()` to use `allBrandImages` instead of just `scrapedImages` when generating brand variations
- Brand variations will now incorporate both website photos AND user-uploaded images as AI reference images

**Upload Workflow**:
- User clicks "+" tile
- File input opens
- FileReader converts selected files to data URLs (e.g., `data:image/png;base64,...`)
- Data URLs are pushed to `uploadedImages`
- New thumbnails appear instantly in gallery

### Key Code Patterns

```typescript
// State additions
const [uploadedImages, setUploadedImages] = useState<string[]>([]);
const [removedImages, setRemovedImages] = useState<Set<string>>(new Set());

// Computed gallery images
const allBrandImages = [
  ...scrapedImages,
  ...uploadedImages
].filter(url => !removedImages.has(url));

// In buildVariations:
const realImages = allBrandImages.slice(0, 3); // Use combined list
```

### What Doesn't Change

- Edge functions (no changes)
- AI generation prompts (same as before)
- Palette selector UI/logic
- Color Palette functionality (stays as-is)
- Card grid layout (2x2 with Brand/AI side-by-side)
- Caption generation
- Regenerate button
- Download/Save buttons on image carousel

### Files Modified

- `src/pages/Marketing.tsx` only - add states, update gallery rendering, update buildVariations logic

