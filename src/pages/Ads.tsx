import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Plus, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { FacebookConnectButton } from '@/components/ads/FacebookConnectButton';

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
  const [creating, setCreating] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['member-ad-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
        body: { action: 'listCampaigns' },
      });
      if (error) throw error;
      return (data?.campaigns ?? []) as Campaign[];
    },
  });

  const createCampaign = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('managed-ad-campaigns', {
      body: { action: 'createCampaign' },
    });
    setCreating(false);
    const message = (data as { error?: string } | null)?.error;
    if (error || message) return toast.error(message || 'No active Barber Launch campaign template is configured');
    toast.success('Campaign created.');
    queryClient.invalidateQueries({ queryKey: ['member-ad-campaigns'] });
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs tracking-[.18em] text-primary font-semibold">ADS</span>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">Your campaigns</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Barber Launch runs your ads from our managed Meta account.
            </p>
          </div>
          <Button size="sm" onClick={createCampaign} disabled={creating}>
            <Plus className="w-4 h-4 mr-2" />
            {creating ? 'Working…' : 'New campaign'}
          </Button>
        </div>

        <div className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Facebook Page</p>
            <p className="text-xs text-muted-foreground mt-1">Connect the Page your ads will run from.</p>
          </div>
          <FacebookConnectButton />
        </div>

        {isLoading ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
            No campaigns yet.
          </div>
        ) : (
          campaigns.map((c) => {
            const balance = c.funded_cents - c.spent_cents;
            return (
              <div key={c.id} className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-primary" />
                      <p className="font-medium">{c.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {money(c.daily_budget_cents)}/day
                    </p>
                  </div>
                  <Badge variant={c.desired_status === 'active' ? 'default' : 'secondary'}>
                    {c.desired_status === 'active' ? 'On' : 'Off'}
                  </Badge>
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Payments are not enabled for this test.
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
