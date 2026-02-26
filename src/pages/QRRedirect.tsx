import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function QRRedirect() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!shortCode) { setError(true); return; }

    (async () => {
      const { data, error: err } = await supabase.rpc('resolve_qr_link', { code: shortCode });
      if (err || !data || data.length === 0) {
        setError(true);
        return;
      }
      window.location.href = data[0].destination_url;
    })();
  }, [shortCode]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
        <h1 className="text-2xl font-bold mb-2">Link Not Found</h1>
        <p className="text-muted-foreground">This QR code is no longer active or the link is invalid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
