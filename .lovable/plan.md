

## Strengthen Anti-Cropping and Add Before/After Rules

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Update Rule 9 (line 206)**

Replace:
```
9. FACE PROTECTION: Never crop or cut off faces — if a person is in the image, their full face (forehead to chin) must be fully visible within the frame.
```
With:
```
9. PERSON FRAMING: Never crop or cut off a person's head, hair, forehead, or face. The full head including all hair must be visible within the frame with breathing room above. Shoulders, arms, and body may be cropped if needed.
```

**2. Add Rule 13 for before/after photos (after Rule 12)**

```
13. BEFORE-AND-AFTER PHOTOS: If the reference photo contains a before-and-after comparison (two sides showing a transformation), you MUST display BOTH sides completely. Never crop, hide, or cut off either the "before" or "after" side. Scale the photo down if needed to fit both sides entirely within the frame. Showing only one side of a transformation is strictly forbidden.
```

**3. Add verification checks to the final checklist (after existing checks around lines 213-215)**

```
3. Is any person cut off at the edges of the image (hair, face)? If YES, reframe with more space around them.
4. Does the reference photo show a before-and-after transformation? If YES, are BOTH sides fully visible? If either side is cropped, scale down and reposition to show the complete transformation.
```

### What stays the same
- All layout descriptions, retry logic, reference photo handling
- Rules 1-8, 10-12
- Brand name conditional logic

