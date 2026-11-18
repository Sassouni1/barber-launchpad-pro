import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Status = {
  state: string; token_source: string | null; renewable: boolean | null; expires_at: string | null;
  last_checked_at: string | null; last_renewed_at: string | null; last_error_code: number | null;
  last_error_message: string | null; action_required: string | null;
};

const LABEL: Record<string, string> = {
  healthy: 'Healthy', expiring: 'Expiring soon', renewal_failed: 'Renewal failed', expired: 'Expired',
  revoked: 'Revoked', missing: 'Missing', invalid: 'Not usable', check_failed: 'Check failed', unchecked: 'Not checked yet',
};
const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

/** Admin-only, credential-free view of the agency Meta token health. */
export function MetaAgencyTokenHealth() {
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const { data } = useQuery({
    queryKey: ['meta-agency-credential-status'],
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase.from('meta_agency_credential_status').select(
        'state,token_source,renewable,expires_at,last_checked_at,last_renewed_at,last_error_code,last_error_message,action_required').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data as Status | null;
    },
  });
  const check = async () => {
    setChecking(true);
    const { error } = await supabase.functions.invoke('meta-agency-credential', { body: { action: 'check' } });
    setChecking(false);
    if (error) toast.error('The token check could not finish. Nothing was changed.');
    await qc.invalidateQueries({ queryKey: ['meta-agency-credential-status'] });
  };
  if (!data) return null;
  const ok = data.state === 'healthy';
  return <div className="rounded-lg border border-border bg-card p-4 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
        <span className="font-semibold">Barber Launch Meta server token</span>
        <Badge variant={ok ? 'secondary' : 'destructive'}>{LABEL[data.state] ?? data.state}</Badge>
      </div>
      <Button size="sm" variant="outline" disabled={checking} onClick={check}>
        {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}Check now
      </Button>
    </div>
    <p className="text-sm text-muted-foreground">
      Expires: {data.expires_at ? fmt(data.expires_at) : data.state === 'healthy' ? 'No expiry reported by Meta' : '—'} ·
      Last checked: {fmt(data.last_checked_at)} · Last renewed: {fmt(data.last_renewed_at)}
      {data.renewable === false && ' · Automatic renewal not available'}
    </p>
    {data.last_error_message && <p className="text-sm">{data.last_error_message}{data.last_error_code !== null && ` (Meta code ${data.last_error_code})`}</p>}
    {data.action_required && <p className="text-sm text-destructive">{data.action_required}</p>}
  </div>;
}
