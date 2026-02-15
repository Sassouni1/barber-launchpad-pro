

## Fix Hair Cropping in Generated Marketing Images

### Problem
The generated image cuts off the "after" side's hair at the top-right corner. The current rules say to scale down if needed, but the layout instructions contradict this by telling the AI to use "FULL width" for the reference photo. The AI is prioritizing filling the space over keeping the subject fully visible.

### Changes

**File: `supabase/functions/generate-marketing-image/index.ts`**

**1. Update layout instructions (lines 93-96) to emphasize scaling down**

All three layout descriptions that mention reference photos need stronger language about scaling down to show the complete photo. Change "at FULL width without any cropping" to instructions that prioritize showing the entire photo over filling the space:

- Layout 0 (line 93): Change "right 75% features the reference photo at FULL width without any cropping" to "right 75% features the reference photo scaled to fit ENTIRELY within this area — the COMPLETE photo must be visible including all hair and heads, even if it means leaving some background padding around the photo. Never zoom in or crop any edge."
- Layout 1 (line 95): Add "Scale the reference photo to fit entirely within the frame — never zoom in or crop edges."
- Layout 2 (line 96): Add same scaling language.

**2. Strengthen Rule 9 (line 209)**

Replace:
```
9. PERSON FRAMING: Never crop or cut off a person's head, hair, forehead, or face. The full head including all hair must be visible within the frame with breathing room above. Shoulders, arms, and body may be cropped if needed.
```
With:
```
9. PERSON FRAMING: Never crop or cut off a person's head, hair, forehead, or face at ANY edge of the image — top, bottom, left, or right. The full head including ALL hair must be visible with breathing room on every side. Scale the photo smaller if needed to achieve this. It is better to have empty space around the photo than to cut off any hair. Shoulders, arms, and body may be cropped if needed.
```

**3. Strengthen Rule 13 (line 213)**

Replace:
```
13. BEFORE-AND-AFTER PHOTOS: If the reference photo contains a before-and-after comparison...Scale the photo down if needed to fit both sides entirely within the frame.
```
With:
```
13. BEFORE-AND-AFTER PHOTOS: If the reference photo contains a before-and-after comparison (two sides showing a transformation), you MUST display BOTH sides completely — every pixel of both the "before" and "after" must be visible. Scale the entire photo DOWN until it fits completely within the frame with NO cropping on ANY edge. It is better to have the photo appear smaller with padding than to crop any part of either side. Showing only one side or cropping the top of either person's head/hair is strictly forbidden.
```

**4. Update verification check 3 (line 221)**

Replace:
```
3. Is any person cut off at the edges of the image (hair, face)? If YES, reframe with more space around them.
```
With:
```
3. Check ALL FOUR edges of the image (top, right, bottom, left). Is any person's head or hair touching or cut off at ANY edge? If YES, scale the photo smaller and reposition it with padding on all sides.
```

### What stays the same
- All other rules (1-8, 10-12, 14)
- Retry logic, base64 fetching, brand name conditionals
- Headline pools, content stripping
- Verification checks 1, 2, 4, 5, 6
