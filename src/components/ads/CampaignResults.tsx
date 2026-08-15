import { useQuery } from '@tanstack/react-query';
import { BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export type CampaignResultsData = {
  available: boolean;
  reason?: 'not_configured' | 'campaign_not_live' | 'no_data';
  range_days?: number;
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-[.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function CampaignResults({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useQuery({
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

  return (
    <div className="border-t border-border/60 pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium">Campaign results</p>
        {data?.range_days && data.available && (
          <span className="text-xs text-muted-foreground">Last {data.range_days} days</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading results…
        </div>
      ) : !data?.available ? (
        <p className="text-sm text-muted-foreground">
          Results will appear once your campaign begins delivering.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Total leads" value={number(data.total_leads ?? 0)} />
            <Metric
              label="Cost per lead"
              value={
                typeof data.cost_per_lead_cents === 'number' ? money(data.cost_per_lead_cents) : '—'
              }
            />
            <Metric label="Total reach" value={number(data.total_reach ?? 0)} />
            <Metric label="Total views" value={number(data.total_views ?? 0)} />
          </div>

          {data.appointments_available && typeof data.cost_per_appointment_cents === 'number' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Cost per appointment" value={money(data.cost_per_appointment_cents)} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Cost per appointment becomes available once appointment-calendar attribution is
              connected.
            </p>
          )}

          {data.last_updated_at && (
            <p className="text-xs text-muted-foreground">
              Updated {new Date(data.last_updated_at).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
