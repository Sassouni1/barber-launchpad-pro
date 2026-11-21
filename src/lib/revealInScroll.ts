type Box = { top: number; bottom: number };

/**
 * How far to scroll a container down so `section` fits inside it, without pushing the
 * section's top (e.g. its header row) out of view. 0 when already fully visible.
 */
export function revealScrollDelta(container: Box, section: Box, margin = 8): number {
  const overflowBelow = section.bottom + margin - container.bottom;
  if (overflowBelow <= 0) return 0;
  const roomAbove = Math.max(0, section.top - margin - container.top);
  return Math.min(overflowBelow, roomAbove);
}

/** Smoothly scrolls the nearest Radix ScrollArea viewport (or scrollable parent) to reveal `el`. */
export function revealInScrollParent(el: HTMLElement | null) {
  if (!el) return;
  const viewport = el.closest<HTMLElement>('[data-radix-scroll-area-viewport]');
  if (!viewport) return;
  const delta = revealScrollDelta(viewport.getBoundingClientRect(), el.getBoundingClientRect());
  if (delta > 0) viewport.scrollBy({ top: delta, behavior: 'smooth' });
}
