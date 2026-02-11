

## Fix Calendar Scroll — Trapped by CSS and External Script

### The Problem
The booking calendar iframe is "frozen" because scroll events can't reach the iframe content. Three things are combining to cause this:

1. **`overflow-hidden` on the iframe's parent div** — This clips and traps scroll events
2. **The external `form_embed.js` script** — It dynamically resizes the iframe and temporarily sets `pointer-events: none`, which blocks interaction
3. **The iframe height is too small** — The external script sets the iframe to ~860px, but the calendar content (with the booking button) needs more room

### The Fix

**File: `src/pages/ScheduleCall.tsx`**

Two changes:

1. **Remove `overflow-hidden` from the iframe wrapper div** — Change `rounded-lg overflow-hidden` to just `rounded-lg`. The `overflow-hidden` is cutting off and trapping scroll inside the container.

2. **Remove the external `form_embed.js` script entirely** — This script is the main culprit. It injects an iframe resizer that:
   - Sets `pointer-events: none` during initialization
   - Overrides the iframe height to values too small for the full content
   - Adds its own overflow rules that conflict with scrolling
   
   The iframe works fine without it — the `src` URL loads the booking widget directly. The script was meant to auto-resize, but it's actually making things worse.

3. **Set iframe height to a large fixed value** — Use `minHeight: 1200px` to ensure the full calendar plus the booking button are visible without needing to scroll inside the iframe at all.

### Technical Details

```text
Before:
- div: className="mt-6 rounded-lg overflow-hidden"
- useEffect loads form_embed.js script
- iframe: minHeight 1000px

After:
- div: className="mt-6 rounded-lg"
- No external script loading
- iframe: minHeight 1200px
```

This eliminates all three scroll-trapping mechanisms at once.
