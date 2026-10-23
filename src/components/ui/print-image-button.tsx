import { useEffect, useRef, useState } from 'react';
import { Printer, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { downloadLandscapeCertificatePdf, preparePrintImage, printPreparedImage } from '@/lib/fileDownloads';

const safari = /^((?!chrome|crios|fxios|edg|opr).)*safari/i.test(navigator.userAgent);

export function PrintImageButton({ url, title = 'Certificate', className, label = 'Print' }: { url: string; title?: string; className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const readyImage = useRef<HTMLImageElement | null>(null);

  // Load the certificate as soon as the button shows, so the tap can print
  // immediately (Safari only allows printing reliably inside the tap itself).
  useEffect(() => {
    readyImage.current = null;
    if (!url) return;
    let active = true;
    preparePrintImage(url).then((img) => { if (active) readyImage.current = img; }).catch(() => {});
    return () => { active = false; };
  }, [url]);

  const print = async () => {
    if (safari) {
      setBusy(true);
      try {
        const img = readyImage.current || await preparePrintImage(url);
        readyImage.current = img;
        await downloadLandscapeCertificatePdf(img, title);
        toast.info('Open the downloaded PDF in Preview to print it in landscape.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not prepare the certificate PDF');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (readyImage.current) {
      printPreparedImage(readyImage.current, title);
      return;
    }
    setBusy(true);
    try {
      const img = await preparePrintImage(url);
      readyImage.current = img;
      printPreparedImage(img, title);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare the certificate for printing');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={print} disabled={busy || !url} className={className}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : safari ? <Download className="h-3.5 w-3.5" /> : <Printer className="h-3.5 w-3.5" />}
      {busy ? 'Preparing…' : safari ? 'Landscape PDF' : label}
    </Button>
  );
}
