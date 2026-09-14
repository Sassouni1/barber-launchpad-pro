import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PayoutConnectionCard } from '@/components/earnings/PayoutConnectionCard';
import { AffiliateProgramPanel, money, type PortalData } from '@/components/earnings/AffiliateProgramPanel';

/** Affiliate Program — its own page. Content Rewards lives at /content-rewards. */
export default function Affiliates() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = async (action: 'summary' | 'enroll' = 'summary') => {
    const { data: res, error } = await supabase.functions.invoke('affiliate-portal', { body: { action } });
    if (error) {
      toast({ title: 'Could not load your referrals', description: 'Please try again in a moment.', variant: 'destructive' });
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

  const commissions = (data?.commissions ?? []).filter((c) => (c.source ?? 'affiliate') === 'affiliate');
  const sum = (fn: (c: (typeof commissions)[number]) => boolean) =>
    commissions.filter(fn).reduce((acc, c) => acc + c.amount_cents, 0);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Bonus Earnings</div>
          <h1 className="text-2xl md:text-3xl font-bold">Affiliate Program</h1>
          <p className="text-muted-foreground mt-1">
            Earn 20% when someone you refer enrolls in Barber Launch — $600 on the $3,000 program.
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
            )}

            {commissions.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm font-medium">Referral earnings</div>
                  {commissions.slice(0, 20).map((c) => (
                    <div key={c.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                      <div className="min-w-0">
                        <div>Referral</div>
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

            <AffiliateProgramPanel data={data} onEnroll={join} joining={joining} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
