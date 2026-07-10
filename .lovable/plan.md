Smart scroll for selected lesson

Scroll only when a user clicks a lesson that is off-screen in the sidebar. If the card is already visible, do nothing — no jump, no shake.

Behavior

Back from a lesson → no auto-scroll. The URL already carries ?module=..., and the selected card will be visible because the user is returned to the same list position they left.
Click a lesson already visible → no scroll at all.
Click a lesson partially or fully off-screen (e.g. way down the list) → smooth scroll into view, aligned to nearest so it only moves the minimum needed.
How to decide "is it visible"

Use getBoundingClientRect() on the module card and compare against the viewport. Treat as visible only if the full card (top and bottom) sits inside the viewport with a small margin (~40px). If a card is half cut off, scroll.
Safety guarantees (why it will never block scrolling)

The scroll is triggered by a single click event, not by a continuous effect or observer. It never runs while the user is actively dragging/scrolling.
Runs inside requestAnimationFrame after the DOM updates, so measurements are accurate and one-shot.
No-ops when the element isn't found (course still loading, wrong tab, etc.).
Uses block: "nearest" so it only moves the minimum needed — never jumps when unnecessary.
Mobile path is untouched (isDesktop guard stays).
Technical

File: src/pages/Courses.tsx
Remove the current "scroll once" ref gate entirely.
When selectedModuleParam changes (or the effect runs for desktop), after rAF:
Find [data-module-id="..."]. If not found, return.
Get its rect; if top >= 40 && bottom <= window.innerHeight - 40, do nothing.
Otherwise call scrollIntoView({ behavior: "smooth", block: "nearest" }).