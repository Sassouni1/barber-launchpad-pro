import { useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { printImageFromUrl } from '@/lib/fileDownloads';

export function PrintImageButton({ url, title = 'Certificate', className, label = 'Print' }: { url: string; title?: string; className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);

  const print = async () => {
    setBusy(true);
    try {
      const opened = await printImageFromUrl(url, title);
      if (!opened) toast.error('Could not open the print view. Please try again.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare the file for printing');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={print} disabled={busy} className={className}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
      {busy ? 'Preparing…' : label}
    </Button>
  );
}
