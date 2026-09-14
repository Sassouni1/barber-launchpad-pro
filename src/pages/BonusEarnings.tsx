import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PayoutConnectionCard } from '@/components/earnings/PayoutConnectionCard';
import { AffiliateProgramPanel, money, type PortalData } from '@/components/earnings/AffiliateProgramPanel';
import { ContentRewardsPanel } from '@/components/earnings/ContentRewardsPanel';

const SOURCE_LABEL: Record<string, string> = {
  affiliate: 'Referral',
  content: 'Content reward',
};

export default function BonusEarnings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'content' ? 'content' : 'affiliate';
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = async (action: 'summary' | 'enroll' = 'summary') => {
    const { data: res, error } = await supabase.functions.invoke('affiliate-portal', { body: { action } });
    if (error) {
      toast({ title: 'Could not load your earnings', description: 'Please try again in a moment.', variant: 'destructive' });
      return;
    }
    setData(res as PortalData);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const join = async () => {
    setJoining(true);
    await load('enroll');
    setJoining(false);
  };

  const commissions = data?.commissions ?? [];
  const sum = (fn: (c: (typeof commissions)[number]) => boolean) =>
    commissions.filter(fn).reduce((acc, c) => acc + c.amount_cents, 0);
  const earnedPending = sum((c) => c.status === 'pending');
  const earnedVerified = sum((c) => c.status === 'verified');
  const earnedPaid = sum((c) => c.status === 'paid');

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Bonus Earnings</h1>
          <p className="text-muted-foreground mt-1">
            Everything you can earn on top of your own client work — referrals and content — paid to one bank account.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <PayoutConnectionCard />

            {commissions.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Waiting on review', value: money(earnedPending) },
                  { label: 'Ready to be sent', value: money(earnedVerified) },
                  { label: 'Sent', value: money(earnedPaid) },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                      <div className="text-lg font-semibold mt-1">{s.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {commissions.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm font-medium">All earnings</div>
                  {commissions.slice(0, 20).map((c) => (
                    <div key={c.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                      <div className="min-w-0">
                        <div>{SOURCE_LABEL[c.source ?? 'affiliate'] ?? 'Earning'}</div>
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
            )}

            <Tabs value={tab} onValueChange={(v) => setParams(v === 'content' ? { tab: 'content' } : {}, { replace: true })}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="affiliate">Affiliate Program</TabsTrigger>
                <TabsTrigger value="content">Content Rewards</TabsTrigger>
              </TabsList>
              <TabsContent value="affiliate" className="mt-6">
                <AffiliateProgramPanel data={data} onEnroll={join} joining={joining} />
              </TabsContent>
              <TabsContent value="content" className="mt-6">
                <ContentRewardsPanel onChanged={() => void load()} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
