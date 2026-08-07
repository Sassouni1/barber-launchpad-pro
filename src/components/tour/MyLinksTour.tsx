import { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { CornerDownRight } from 'lucide-react';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MyLinksTourProps {
  open: boolean;
  onClose: () => void;
  /** css selector of the element to highlight */
  target?: string;
  title?: string;
  body?: string;
}

const PAD = 10;

/**
 * Lightweight walkthrough coach-mark: dims the page, cuts a spotlight around
 * the target nav item, draws a pointer arrow to it and shows a small note
 * with "Got it" / "Ignore".
 */
export function MyLinksTour({
  open,
  onClose,
  target = '[data-tour="my-links"]',
  title = "Here's where you'll find your links",
  body = 'Your payment links live in My Links. Open it any time from the menu to copy, share or create new ones.',
}: MyLinksTourProps) {
  const isMobile = useIsMobile();
  const [rect, setRect] = useState<Rect | null>(null);

  // Ask the mobile nav to open its menu so the item is visible.
  useEffect(() => {
    if (!open || !isMobile) return;
    window.dispatchEvent(new CustomEvent('tour:open-mobile-menu'));
  }, [open, isMobile]);

  const measure = useCallback(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(target));
    // pick the visible one (sidebar on desktop, sheet row on mobile)
    const el = els.find((e) => e.getBoundingClientRect().width > 0);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [target]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const id = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const spotlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Note placement: to the right of the item on desktop, below it on mobile.
  const noteStyle: React.CSSProperties = spotlight
    ? isMobile
      ? {
          top: Math.min(spotlight.top + spotlight.height + 16, window.innerHeight - 210),
          left: 16,
          right: 16,
        }
      : {
          top: Math.min(Math.max(spotlight.top - 24, 16), window.innerHeight - 230),
          left: spotlight.left + spotlight.width + 56,
          width: 320,
        }
    : { top: 24, left: 24, right: 24 };

  return createPortal(
    <div className="fixed inset-0 z-[300]">
      {/* dim layer with a cut-out via box-shadow */}
      <div className="absolute inset-0" onClick={onClose}>
        {spotlight ? (
          <div
            className="absolute rounded-xl border-2 border-primary transition-all duration-300"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: '0 0 0 9999px hsl(var(--background) / 0.82), 0 0 22px hsl(var(--primary) / 0.5)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-background/80" />
        )}
      </div>

      {/* pointer arrow from the note back to the item (desktop only) */}
      {spotlight && !isMobile && (
        <CornerDownRight
          className="absolute w-8 h-8 text-primary -scale-x-100 pointer-events-none"
          style={{
            top: spotlight.top + spotlight.height / 2 - 26,
            left: spotlight.left + spotlight.width + 12,
          }}
        />
      )}

      <div
        className="absolute rounded-xl border border-primary/40 bg-card p-4 shadow-2xl"
        style={noteStyle}
      >
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Ignore
          </Button>
          <Button size="sm" className="gold-gradient text-black font-semibold" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
