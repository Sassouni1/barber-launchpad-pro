

## Fix: Image Generation Disappears When Switching Tabs

### Problem

When you switch to another browser tab during image generation, the process appears to stop and images disappear. This happens because:

1. The `resizeImage` function creates an HTML canvas and `new Image()` object -- browsers throttle or block these operations in background tabs
2. The `.then()` callbacks on the fetch promises can silently fail when the tab is inactive
3. There is no retry or persistence mechanism -- if a callback fails, the image is lost

### Solution

Two changes to make this robust:

**1. Remove the client-side `resizeImage` step entirely**

The `resizeImage` function is unnecessary -- it resizes a 1080px image to 1080px (same size). The AI model already generates images at the correct dimensions. Removing this eliminates the canvas/Image dependency that breaks in background tabs.

**2. Use `async/await` with error handling instead of fire-and-forget `.then()`**

Wrap each `generateSlot` call in a proper `async` function with `try/catch`, and use `Promise.allSettled` to track all generations. This ensures that even if one call fails, others continue, and state is always updated.

**3. Add a `useRef` flag to prevent stale state on unmount**

Store a ref that tracks whether the component is still mounted, so state updates from long-running promises don't cause errors if the user navigates away from the page entirely.

### Technical Details

**File: `src/pages/Marketing.tsx`**

- Remove the `resizeImage` function (lines 41-56) -- it serves no purpose since source and target are both 1080px
- Rewrite `generateSlot` to be an `async` function that uses `await` instead of `.then()`:
  - `await supabase.functions.invoke(...)` 
  - Directly use `data.imageUrl` without resizing
  - Wrap in `try/catch` so failures update state with `null` instead of silently dropping
- Add an `isMountedRef` using `useRef(true)` set to `false` on cleanup, checked before `setVariations`
- Keep the same parallel execution pattern (all slots fire at once) but track with `Promise.allSettled`

### What This Fixes

- Images will no longer disappear when switching tabs -- there is no canvas/Image dependency
- Failed generations will show as empty slots rather than silently vanishing
- The generation process will complete in the background regardless of tab focus

