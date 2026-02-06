

# Bulletproof the Video Player

## Summary
Three small, safe changes that protect the Vimeo iframe from every remaining re-render trigger. No functionality or visual changes.

## Changes

### 1. Extract the video player into a `React.memo` component
**File:** `src/pages/Lesson.tsx`

Create a small memoized component at the top of the file:

```tsx
const VideoPlayer = React.memo(({ src, title }: { src: string; title: string }) => (
  <div className="glass-card rounded-2xl overflow-hidden">
    <div className="aspect-video max-h-[50vh] bg-black relative">
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title={title}
      />
    </div>
  </div>
));
```

Replace the current inline iframe block (lines 347-359) with:

```tsx
{module.video_url?.trim() && !(module as any).is_certification_requirement && (
  <VideoPlayer src={vimeoEmbedUrl} title={module.title} />
)}
```

This means even if the parent Lesson component re-renders (from auth token refresh, quiz state changes, etc.), the VideoPlayer will only re-render if `src` or `title` actually change.

### 2. Remove `animate-fade-up` from the video container
Already handled by the extraction above -- the new `VideoPlayer` component simply doesn't include the animation class. This eliminates the GPU compositing overhead that could cause micro-stalls on low-end mobile devices.

## What stays the same
- All other animations on the page remain
- Video loads and plays identically
- Desktop experience unchanged
- Quiz, homework, resources all unaffected

## Technical details
- `React.memo` does a shallow prop comparison: `src` (string) and `title` (string) are both primitives, so the comparison is trivial and reliable
- The `useMemo` for `vimeoEmbedUrl` (already in place) ensures the `src` prop reference stays stable
- Combined, these two layers guarantee the iframe is never destroyed/recreated unless the user navigates to a different lesson

