

## Rename to "AI Social Media Generator" + Persist Generated Images

### Changes Overview

1. **Rename** all references from "AI Marketing Generator" to "AI Social Media Generator"
2. **Save generated images** to storage after each one is created, with metadata in the database
3. **Show a "Previously Generated" section** below the current results, loading saved images grouped by generation session
4. **Images auto-delete after 24 hours** (already handled by the existing cleanup function)

---

### Technical Details

#### 1. Rename (3 files)

- **`src/pages/Marketing.tsx`** line 395: Change heading from "AI Marketing Generator" to "AI Social Media Generator"
- **`src/components/layout/Sidebar.tsx`** line 223: Change nav label from "AI Marketing" to "AI Social Media"
- **`src/components/layout/MobileNav.tsx`**: Update the corresponding label if present

#### 2. Persist images to storage (`src/pages/Marketing.tsx`)

After each image is successfully generated in the `generateSlot` function:
- Convert the data URL to a Blob
- Upload it to the `marketing-images` storage bucket with a unique path like `{userId}/{timestamp}-{index}.png`
- Insert a record into `marketing_images` table with `storage_path`, `public_url`, `variation_type`, `caption`, and `website_url`
- Replace the in-memory data URL with the public storage URL so the carousel uses the persistent URL

#### 3. Load previously generated images on page mount

- On component mount, query `marketing_images` table for the current user's images (ordered by `created_at desc`)
- Group them by `variation_type` and display in a "Previously Generated" section below the main results
- Each group shows as a carousel with download buttons (using the existing `download-file` edge function proxy for reliable downloads)
- Include a small timestamp label showing when each set was generated

#### 4. Download button behavior

- The existing "Save" button in the `ImageCarousel` component will use the storage public URL directly
- For mobile compatibility, route downloads through the `download-file` edge function (already exists)

#### 5. Cleanup (already implemented)

- The `cleanup-marketing-images` edge function already deletes images older than 24 hours from both storage and the database table
- This function is already triggered on page load

