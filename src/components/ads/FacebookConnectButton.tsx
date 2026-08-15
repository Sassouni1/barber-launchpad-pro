import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Facebook, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdSocialConnection } from '@/hooks/useAdSocialConnection';

export function FacebookConnectButton({
  showPageName = true,
  connectedLabel = 'Reconnect Facebook',
}: {
  showPageName?: boolean;
  connectedLabel?: string;
} = {}) {
  const [loading, setLoading] = useState(false);

  const { data: connection } = useAdSocialConnection();


  const connect = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-social', {
      body: { action: 'getConnectUrl' },
    });
    setLoading(false);
    if (error || !data?.url) {
      toast.error(error?.message || data?.error || 'Could not start the Facebook connection.');
      return;
    }
    // Facebook refuses to load inside an iframe (and the Lovable preview is one),
    // so always hand the OAuth screen to a real top-level browser tab.
    const opened = window.open(data.url as string, '_blank', 'noopener,noreferrer');
    if (!opened) {
      try {
        window.top!.location.href = data.url as string;
      } catch {
        toast.error('Please allow pop-ups so Facebook can open in a new tab.');
      }
    }
  };


  const connected = connection?.connection_status === 'connected';

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant={connected ? 'outline' : 'default'} onClick={connect} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Facebook className="w-4 h-4 mr-2" />}
        {connected ? connectedLabel : 'Connect Facebook'}
      </Button>
      {showPageName && connection?.facebook_page_name && (
        <span className="text-sm text-muted-foreground truncate">
          Page: <span className="text-foreground">{connection.facebook_page_name}</span>
        </span>
      )}
    </div>
  );
}
