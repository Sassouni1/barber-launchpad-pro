import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PayoutConnectionCard } from '@/components/earnings/PayoutConnectionCard';
import { ContentRewardsPanel } from '@/components/earnings/ContentRewardsPanel';
import { money, type PortalData } from '@/components/earnings/AffiliateProgramPanel';

/**
 * Content Rewards — its own page. Joining the affiliate program is NOT required
 * to submit content or to see payout readiness.
 */
export default function ContentRewards() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: res } = await supabase.functions.invoke('affiliate-portal', { body: { action: 'summary' } });
    if (res) setData(res as PortalData);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const rewards = (data?.commissions ?? []).filter((c) => c.source === 'content');
  const sum = (fn: (c: (typeof rewards)[number]) => boolean) =>
    rewards.filter(fn).reduce((acc, c) => acc + c.amount_cents, 0);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Bonus Earnings</div>
          <h1 className="text-2xl md:text-3xl font-bold">Content Rewards</h1>
          <p className="text-muted-foreground mt-1">
            Send in your before-and-after photos, install videos and other work. Approved content earns a reward.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <PayoutConnectionCard />

            {rewards.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Waiting on review', value: money(sum((c) => c.status === 'pending')) },
                    { label: 'Ready to be sent', value: money(sum((c) => c.status === 'verified')) },
                    { label: 'Sent', value: money(sum((c) => c.status === 'paid')) },
                  ].map((s) => (
                    <Card key={s.label}>
                      <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                        <div className="text-lg font-semibold mt-1">{s.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="text-sm font-medium">Content reward earnings</div>
                    {rewards.slice(0, 20).map((c) => (
                      <div key={c.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                        <div className="min-w-0">
                          <div>Content reward</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}{c.note ? ` \u2014 ${c.note}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className="capitalize">{c.status}</Badge>
                          <span className={c.amount_cents < 0 ? 'text-destructive font-medium' : 'font-medium'}>
                            {money(c.amount_cents)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}

            <ContentRewardsPanel onChanged={() => void load()} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
