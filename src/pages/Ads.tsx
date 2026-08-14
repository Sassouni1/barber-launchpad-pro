import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Megaphone, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { FacebookConnectButton } from '@/components/ads/FacebookConnectButton';
import { InstagramStatusCard } from '@/components/ads/InstagramStatusCard';

type Campaign = {
  id: string;
  name: string;
  status: string;
  desired_status: string;
  daily_budget_cents: number;
  funded_cents: number;
  spent_cents: number;
};

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function Ads() {
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['member-ad-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
        body: { action: 'getDashboard' },
      });
      if (error) throw error;
      return (data?.campaigns ?? []) as Campaign[];
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <span className="text-xs tracking-[.18em] text-primary font-semibold">ADS</span>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">Your campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Barber Launch sets up and runs your campaigns from our managed Meta account.
          </p>
        </div>

        <div className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Facebook Page</p>
            <p className="text-xs text-muted-foreground mt-1">Connect the Page your ads will run from.</p>
          </div>
          <FacebookConnectButton />
        </div>

        <InstagramStatusCard />


        {isLoading ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
            No campaigns yet. Barber Launch will add your campaigns here.
          </div>
        ) : (
          campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ['member-ad-campaigns'] })}
            />
          ))
        )}
      </div>
    </DashboardLayout>
  );
}

function CampaignCard({ campaign, onChanged }: { campaign: Campaign; onChanged: () => void }) {
  const [budget, setBudget] = useState((campaign.daily_budget_cents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const balance = campaign.funded_cents - campaign.spent_cents;
  const on = campaign.desired_status === 'active';

  useEffect(() => {
    setBudget((campaign.daily_budget_cents / 100).toFixed(2));
  }, [campaign.daily_budget_cents]);

  const toggle = async (next: boolean) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
      body: { action: 'setDesiredStatus', campaign_id: campaign.id, desired_status: next ? 'active' : 'paused' },
    });
    setBusy(false);
    const message = (data as { error?: string } | null)?.error;
    if (error || message) {
      return toast.error(message || 'This campaign has no media balance, so it cannot be turned on.');
    }
    toast.success(next ? 'Campaign set to on.' : 'Campaign set to off.');
    onChanged();
  };

  const saveBudget = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
      body: { action: 'setBudget', campaign_id: campaign.id, daily_budget_cents: Math.round(Number(budget || 0) * 100) },
    });
    setBusy(false);
    const message = (data as { error?: string } | null)?.error;
    if (error || message) return toast.error(message || 'Could not update the daily budget.');
    toast.success('Daily budget updated.');
    onChanged();
  };

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <p className="font-medium">{campaign.name}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{money(campaign.daily_budget_cents)}/day</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={on ? 'default' : 'secondary'}>{on ? 'On' : 'Off'}</Badge>
          <Switch checked={on} disabled={busy} onCheckedChange={toggle} aria-label="Campaign on or off" />
        </div>
      </div>

      <div className="border-t border-border/60 pt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <Label className="text-xs">Daily budget (USD)</Label>
          <Input
            type="number"
            min="10"
            step="1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button size="sm" variant="outline" onClick={saveBudget} disabled={busy}>
          Save budget
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center gap-2 text-sm">
          <WalletCards className="w-4 h-4 text-primary" />
          <span>{money(balance)} media balance</span>
        </div>
        <div className="text-right">
          <Button size="sm" variant="outline" disabled>
            Add funds
          </Button>
          <p className="text-xs text-muted-foreground mt-1">Payments are not enabled for this test.</p>
        </div>
      </div>
    </div>
  );
}
