import { X } from 'lucide-react';
import { useEffect } from 'react';

interface AttachmentLightboxProps {
  url?: string;
  alt: string;
  onClose: () => void;
}

/**
 * Full-screen in-app image viewer. Deliberately renders the image in place so a
 * tap never navigates Safari to the raw asset URL.
 */
export function AttachmentLightbox({ url, alt, onClose }: AttachmentLightboxProps) {
  useEffect(() => {
    if (!url) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88dvh] max-w-full rounded-xl object-contain"
      />
    </div>
  );
}
