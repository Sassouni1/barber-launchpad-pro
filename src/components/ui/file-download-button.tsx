import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deliverFile, fetchDownload } from '@/lib/fileDownloads';

export function FileDownloadButton({ url, filename, className }: { url: string; filename: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const pending = useRef<Promise<Blob> | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const prepare = () => {
    if (!pending.current) {
      pending.current = fetchDownload(url).then(value => { setBlob(value); return value; }).catch(error => {
        pending.current = null;
        throw error;
      });
    }
    return pending.current;
  };

  useEffect(() => {
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
    if (blob) { void deliverFile(blob, filename); return; }
    setBusy(true);
    try {
      const value = await prepare();
      if (matchMedia('(pointer: coarse)').matches) toast.success('File ready. Tap Save again.');
      else await deliverFile(value, filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save file');
    } finally { setBusy(false); }
  };

  return <Button ref={ref} variant="secondary" size="sm" onClick={save} disabled={busy} className={className}>
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
    {busy ? 'Preparing…' : 'Save'}
  </Button>;
}