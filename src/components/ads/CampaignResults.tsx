import { useQuery } from '@tanstack/react-query';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export type CampaignResultsReason = 'not_configured' | 'campaign_not_live' | 'not_synced' | 'sync_error' | 'no_data';

export type CampaignResultsData = {
  available: boolean;
  reason?: CampaignResultsReason;
  range_days?: number;
  last_synced_at?: string | null;
  sync_failed?: boolean;
  last_updated_at?: string | null;
  total_leads?: number;
  cost_per_lead_cents?: number | null;
  total_reach?: number;
  total_views?: number;
  appointments_available?: boolean;
  total_appointments?: number | null;
  cost_per_appointment_cents?: number | null;
};

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const when = (iso: string | null | undefined) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** Honest empty states: each reason says what is actually true, never placeholder numbers. */
const EMPTY_MESSAGE: Record<CampaignResultsReason, string> = {
  campaign_not_live: "Your campaign hasn't been set up in Meta yet. Results will show here once it's running.",
  not_configured: "Results reporting isn't connected yet. Your results will show here once it is.",
  not_synced: 'Your campaign is set up in Meta. Results will show here after the first update.',
  sync_error: "We couldn't get your results from Meta yet. We'll keep trying automatically.",
  no_data: 'No ads have been shown in the last 30 days, so there are no results yet.',
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-[.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function CampaignResults({ campaignId }: { campaignId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['campaign-results', campaignId],
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('managed-ad-reporting', {
        body: { action: 'getResults', campaign_id: campaignId },
      });
      if (error) throw error;
      return data as CampaignResultsData;
    },
  });

  const synced = when(data?.last_synced_at);

  return (
    <div className="border-t border-border/60 pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium">Campaign results</p>
        {data?.available && data.range_days && (
          <span className="text-xs text-muted-foreground">Last {data.range_days} days</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading results…
        </div>
      ) : isError || !data ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive" role="alert">Couldn't load your results.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} /> Try again
          </Button>
        </div>
      ) : !data.available ? (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {EMPTY_MESSAGE[data.reason ?? 'campaign_not_live'] ?? EMPTY_MESSAGE.campaign_not_live}
          </p>
          {synced && <p className="text-xs text-muted-foreground">Last updated {synced}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Total leads" value={number(data.total_leads ?? 0)} />
            <Metric
              label="Cost per lead"
              value={typeof data.cost_per_lead_cents === 'number' ? money(data.cost_per_lead_cents) : '—'}
            />
            <Metric label="Total reach" value={typeof data.total_reach === 'number' ? number(data.total_reach) : '—'} />
            <Metric label="Total views" value={typeof data.total_views === 'number' ? number(data.total_views) : '—'} />
          </div>

          {data.appointments_available && typeof data.cost_per_appointment_cents === 'number' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Cost per appointment" value={money(data.cost_per_appointment_cents)} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Cost per appointment becomes available once appointment-calendar attribution is connected.
            </p>
          )}

          {data.sync_failed && (
            <p className="text-xs text-muted-foreground">
              The latest update from Meta didn't go through. These are your most recent saved results.
            </p>
          )}
          {synced && <p className="text-xs text-muted-foreground">Last updated {synced}</p>}
        </>
      )}
    </div>
  );
}
