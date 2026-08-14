import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { WalletCards } from 'lucide-react';
import { toast } from 'sonner';

type Campaign = {
  id: string;
  name: string;
  status: string;
  desired_status: 'active' | 'paused';
  daily_budget_cents: number;
  funded_cents: number;
  spent_cents: number;
  currency: string;
};

type DashboardData = {
  campaigns: Campaign[];
  billing: { autopay_enabled: boolean } | null;
  transactions: unknown[];
};

type SocialConnection = { facebook_page_id: string | null; facebook_page_name: string | null; connection_status: string };

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', { body: { action, ...payload } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export default function Ads() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['member-managed-ads'],
    queryFn: () => invoke('getDashboard'),
    retry: false,
  });
  const campaigns = data?.campaigns ?? [];
  const { data: socialConnection } = useQuery<SocialConnection | null>({
    queryKey: ['member-ad-social-connection'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ad_social_connections').select('facebook_page_id,facebook_page_name,connection_status').maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['member-managed-ads'] });

  const saveBudget = async (campaign: Campaign, dailyBudget: string) => {
    setBusyId(`budget-${campaign.id}`);
    try {
      await invoke('setBudget', { campaignId: campaign.id, dailyBudget: Number(dailyBudget) });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update budget');
    } finally {
      setBusyId(null);
    }
  };

  const setEnabled = async (campaign: Campaign, enabled: boolean) => {
    setBusyId(`status-${campaign.id}`);
    try {
      const result = await invoke('setDesiredStatus', {
        campaignId: campaign.id,
        desiredStatus: enabled ? 'active' : 'paused',
      });
      if (result.requiresFunding) toast.error('Add funds before turning this campaign on.');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update campaign');
    } finally {
      setBusyId(null);
    }
  };

  const connectFacebook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('managed-ad-social', { body: { action: 'getConnectUrl' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start Facebook connection');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="font-display text-3xl font-semibold">Ads</h1>

        <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
          <span className="text-sm">{socialConnection?.connection_status === 'connected' ? socialConnection.facebook_page_name : 'Facebook Page'}</span>
          <Button variant="outline" size="sm" onClick={connectFacebook}>{socialConnection?.connection_status === 'connected' ? 'Reconnect' : 'Connect Facebook'}</Button>
        </div>

        {isLoading ? <div className="text-muted-foreground">Loading…</div> : campaigns.length === 0 ? (
          <div className="rounded-xl border border-border/60 p-8 text-muted-foreground">Your Barber Launch campaign will appear here when it is prepared.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} busyId={busyId} saveBudget={saveBudget} setEnabled={setEnabled} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function CampaignCard({
  campaign,
  busyId,
  saveBudget,
  setEnabled,
}: {
  campaign: Campaign;
  busyId: string | null;
  saveBudget: (campaign: Campaign, budget: string) => Promise<void>;
  setEnabled: (campaign: Campaign, enabled: boolean) => Promise<void>;
}) {
  const [budget, setBudget] = useState(String(campaign.daily_budget_cents / 100));
  const available = campaign.funded_cents - campaign.spent_cents;
  const canActivate = available >= campaign.daily_budget_cents;
  return <div className="glass-card rounded-xl p-5 space-y-5">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{campaign.name}</h2><Badge variant={campaign.desired_status === 'active' ? 'default' : 'secondary'} className="mt-2 capitalize">{campaign.status.replace('_', ' ')}</Badge></div><Switch checked={campaign.desired_status === 'active'} disabled={busyId === `status-${campaign.id}` || (campaign.desired_status !== 'active' && !canActivate)} onCheckedChange={(checked) => setEnabled(campaign, checked)} /></div>
    <div><Label>Daily budget</Label><div className="flex gap-2 mt-1"><Input type="number" min="10" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} /><Button variant="outline" disabled={busyId === `budget-${campaign.id}`} onClick={() => saveBudget(campaign, budget)}>Save</Button></div></div>
    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Media balance</span><span className="font-medium">{money(available)}</span></div>
    <Button className="w-full" variant="outline" disabled><WalletCards className="w-4 h-4 mr-2" />Payments are not enabled for this test.</Button>
  </div>;
}
