import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAdSocialConnection } from '@/hooks/useAdSocialConnection';
import { adSocialErrorMessage } from '@/lib/adSocialError';
import { pageAdAccessFor } from '@/lib/pageAdAccess';

const checkedLabel = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Last checked ${date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
};

/** Barber Launch asks for advertising-only access to the member's selected Page and shows Meta's confirmed state. */
export function PageAdAccessCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: connection } = useAdSocialConnection();
  const [busy, setBusy] = useState<'grant' | 'check' | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  if (!connection?.facebook_page_id) return null;
  const access = pageAdAccessFor(connection);
  const pageName = connection.facebook_page_name || 'your Page';
  const checked = checkedLabel(access.checkedAt);

  const run = async (kind: 'grant' | 'check') => {
    setBusy(kind);
    setRequestError(null);
    try {
      const { data, error } = await supabase.functions.invoke('managed-ad-social', {
        body: { action: kind === 'grant' ? 'grantPageAdAccess' : 'checkPageAdAccess' },
      });
      if (error || data?.error) {
        setRequestError(await adSocialErrorMessage(data, error, 'Could not reach Facebook. Please try again.'));
      }
    } catch {
      setRequestError('Could not reach Facebook. Check your connection and try again.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['ad-social-connection', user?.id] });
      setBusy(null);
    }
  };

  const grantButton = (label: string) => (
    <Button size="sm" onClick={() => run('grant')} disabled={!!busy}>
      {busy === 'grant' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
      {busy === 'grant' ? 'Asking Facebook…' : label}
    </Button>
  );
  const checkButton = (
    <Button size="sm" variant="outline" onClick={() => run('check')} disabled={!!busy}>
      {busy === 'check' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
      {busy === 'check' ? 'Checking…' : 'Check again'}
    </Button>
  );

  return (
    <div className="space-y-3" aria-live="polite">
      {access.status === 'granted' ? (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-primary font-medium">Advertising access confirmed</span>
          <span className="text-muted-foreground truncate">· {pageName}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Barber Launch needs advertising access to <span className="text-foreground font-medium">{pageName}</span> so we
          can run your ads from it. This only lets us create ads for your Page. We can't post, message, or change your
          Page.
        </p>
      )}

      {access.status === 'pending' && (
        <p className="text-sm text-foreground">{access.message ?? "Request sent. Meta hasn't confirmed it yet."}</p>
      )}
      {access.status === 'error' && (
        <p className="text-sm text-destructive" role="alert">
          {access.message ?? "Facebook couldn't confirm advertising access. Please try again."}
        </p>
      )}
      {requestError && <p className="text-sm text-destructive" role="alert">{requestError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {access.status === 'unknown' && grantButton('Give advertising access')}
        {access.status === 'error' && grantButton('Try again')}
        {(access.status === 'pending' || access.status === 'granted') && checkButton}
      </div>
      {checked && <p className="text-xs text-muted-foreground">{checked}</p>}
    </div>
  );
}
