import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deliverFile, fetchDownload } from '@/lib/fileDownloads';

export function FileDownloadButton({ url, filename, className, label = 'Save', onDelivered }: { url: string; filename: string; className?: string; label?: string; onDelivered?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const pending = useRef<Promise<Blob> | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const source = useRef(url);

  const prepare = () => {
    if (!pending.current) {
      const requestedUrl = url;
      pending.current = fetchDownload(url).then(value => { if (source.current === requestedUrl) setBlob(value); return value; }).catch(error => {
        if (source.current === requestedUrl) pending.current = null;
        throw error;
      });
    }
    return pending.current;
  };

  useEffect(() => {
    source.current = url;
    pending.current = null;
    setBlob(null);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        void prepare().catch(() => {});
        observer.disconnect();
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [url]);

  const save = async () => {
    if (blob) {
      try { if (await deliverFile(blob, filename)) onDelivered?.(); }
      catch { toast.error('Could not save file. Please try again.'); }
      return;
    }
    setBusy(true);
    try {
      const value = await prepare();
      if (matchMedia('(pointer: coarse)').matches) toast.success('File ready. Tap Save again.');
      else if (await deliverFile(value, filename)) onDelivered?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save file');
    } finally { setBusy(false); }
  };

  return <Button ref={ref} variant="secondary" size="sm" onClick={save} disabled={busy} className={className}>
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
    {busy ? 'Preparing…' : label}
  </Button>;
}